#include "artdaq-mu2e/Generators/Mu2eEventReceiverBase.hh"
#include "artdaq-core-mu2e/Overlays/FragmentType.hh"

#include "artdaq-core/Data/ContainerFragmentLoader.hh"
#include "artdaq/DAQdata/Globals.hh"

#include "artdaq/Generators/GeneratorMacros.hh"

#include "trace.h"
#define TRACE_NAME "CRVVstReceiver"

#include "dtcInterfaceLib/DTC.h"
#include "dtcInterfaceLib/DTCSoftwareCFO.h"
#include "dtcInterfaceLib/DTC_Data_Verifier.h"

#include "xmlrpc-c/config.h"  /* information about this build environment */
#include <xmlrpc-c/base.h>
#include <xmlrpc-c/client.h>

using namespace DTCLib;

namespace mu2e {
class CRVVstReceiver : public mu2e::Mu2eEventReceiverBase
{
public:
	explicit CRVVstReceiver(fhicl::ParameterSet const& ps);
	virtual ~CRVVstReceiver();

private:
	// The "getNext_" function is used to implement user-specific
	// functionality; it's a mandatory override of the pure virtual
	// getNext_ function declared in CommandableFragmentGenerator

	bool getNext_(artdaq::FragmentPtrs& output) override;

	std::shared_ptr<artdaq::RequestBuffer> requests_{nullptr};

	std::set<artdaq::Fragment::sequence_id_t> seen_sequence_ids_{};
	size_t sequence_id_list_max_size_{1000};

        mu2e_databuff_t* readDTCBuffer(mu2edev* device, bool& success, bool& timeout, size_t& sts, bool continuedMode);
        bool message(std::string msg_type, std::string message);

        //bool noRequestMode_{false};
        //size_t noRequestModeFirstTimestamp_{0};

        //DTCSoftwareCFO* _cfo;
        uint64_t        _event;
        //mu2edev*        _device;
        unsigned int    _sleepAfterDR; 
        unsigned int    _sleepAfterGetNext;
        unsigned int    _debugMode; 
        bool            _verify_event;
        bool            _check_if_valid;
        std::string     _tfm_host; // used to send xmlrpc messages to

        xmlrpc_env    _env;
};
}  // namespace mu2e

mu2e::CRVVstReceiver::CRVVstReceiver(fhicl::ParameterSet const& ps)
	: Mu2eEventReceiverBase(ps)
        , _sleepAfterDR(ps.get<unsigned int>("sleep_after_dr_ms", 100))
        , _sleepAfterGetNext(ps.get<unsigned int>("sleep_after_get_next_ms", 100))
        , _debugMode(ps.get<unsigned int>("debug_mode", 0))
        , _verify_event(ps.get<bool>("verify_event", false))
        , _check_if_valid(ps.get<bool>("check_if_valid", true))
        , _tfm_host(ps.get<std::string>("tfm_hostname","localhost"))
        //, noRequestMode_(ps.get<bool>("no_request_mode", false))
        //, noRequestModeFirstTimestamp_(ps.get<size_t>("no_request_mode_first_timestamp",0))
{

	//highest_timestamp_seen_ = noRequestModeFirstTimestamp_;
	TLOG(TLVL_DEBUG) << "CRVVstReceiver Initialized with mode " << mode_;

        // Simon
        // The DTC is initialized in the base class (Mu2eEventReceiverBase.hh:) ->theInterface_
        // We want DTC_SimMode_NoCFO -> the mode in the fcl file (sim_mode) needs to start with "4", "n", "N", 
        // see artdaq_core_mu2e/artdaq-core-mu2e/Overlays/DTC_Types.cpp
        if(mode_ != DTCLib::DTC_SimMode_NoCFO) {
            TLOG(TLVL_ERROR) << "The mode is set to '" << mode_ << "', this boardreader is intended to be run with 'DTC_SimMode_NoCFO'. Set 'sim_mode' in the fcl file to '4', 'n', or 'N'.";
        }
        
        //_device = theInterface_->GetDevice();
        theInterface_->SetSequenceNumberDisable(); 
 
        // Simon
        // Setting up the CFO
        // actually, the cfo is set up in the base class!
        /*
        bool          useCFOEmulator (true);
        unsigned      packetCount    (0);
        DTCLib::DTC_DebugType debugType      (DTCLib::DTC_DebugType_SpecialSequence);
        bool          stickyDebugType(true);
        bool          quiet          (true); 
        bool          forceNoDebug   (false); // better true?
        bool          useCFODRP      (false);

        TLOG(TLVL_DEBUG) << "useCFOEmulator, packetCount, debugType, stickyDebugType, quiet, forceNoDebug, useCFODRP:" 
	                 << useCFOEmulator << " " << packetCount << " " << debugType << " " << stickyDebugType 
                         << " " << quiet << " " << forceNoDebug << " " << useCFODRP ;

       
        _cfo = new DTCLib::DTCSoftwareCFO(theInterface_.get(), 
	  		        	  useCFOEmulator, 
				     	  packetCount, 
				          debugType, 
				          stickyDebugType, 
				          quiet, 
				          false, 
				          forceNoDebug, 
				          useCFODRP);
        */

        _event = 0;


        // xmlrpc to communicate with farm manager
        xmlrpc_client_init(XMLRPC_CLIENT_NO_FLAGS, "debug", "v1_0");
        xmlrpc_env_init(&_env);

}

mu2e::CRVVstReceiver::~CRVVstReceiver() {
    //delete _cfo;
}

bool mu2e::CRVVstReceiver::getNext_(artdaq::FragmentPtrs& frags) 
{ 
        if (should_stop()) return false;

	_event += 1;
        TLOG(TLVL_DEBUG) << "getNext_: event " << _event;

	// send out heartbeat and data requests
	int           number = 1;
	bool          incrementTimestamp(true);
	unsigned      cfodelay       (200);
	int           requestsAhead  (0);
	unsigned      heartbeatsAfter(0);

        if (_event == 1) {
            message("info", "getNext: " + std::to_string(_event));
        }



	TLOG(TLVL_DEBUG) << "number, _event, incrementTimestamp, cfodelay, requestsAhead, heartbeatsAfter:" 
			 << number << " " << _event << " " << incrementTimestamp << " " << cfodelay << " " 
			 << requestsAhead << " " << heartbeatsAfter;

        // This comes from the base class!
	theCFO_->SendRequestsForRange(number,
		    		      DTC_EventWindowTag(uint64_t(_event)),
				      incrementTimestamp,
				      cfodelay,
				      requestsAhead,
				      heartbeatsAfter);

	// TODO: make this configurable
	std::this_thread::sleep_for(std::chrono::milliseconds(_sleepAfterDR));

	// Simon, run without a artdaq trigger, request the data from the above sent heartbeat, always

	/*
	if (requests_ == nullptr)
	{
		requests_ = GetRequestBuffer();
	}
	if (requests_ == nullptr)
	{
		TLOG(TLVL_ERROR) << "Request Buffer pointer is null! Returning false!";
		return false;
	}

	while (!should_stop() && !requests_->WaitForRequests(100))
	{
	}*/

	//reqs = requests_->GetAndClearRequests();
	//requests_->reset();

        /*
	for (auto& req : reqs)
	{
		if (seen_sequence_ids_.count(req.first))
		{
			continue;
		}
		else
		{
			seen_sequence_ids_.insert(req.first);
			if (seen_sequence_ids_.size() > sequence_id_list_max_size_)
			{
				seen_sequence_ids_.erase(seen_sequence_ids_.begin());
			}
		}
		TLOG(TLVL_DEBUG) << "Requesting CRV data for Event Window Tag " << req.second;
		auto ret = getNextDTCFragment(frags, DTCLib::DTC_EventWindowTag(req.second));
		if (!ret) return false;
	}*/

        if (_debugMode == 0) {
            auto ret = getNextDTCFragment(frags, DTCLib::DTC_EventWindowTag(_event));
        
            if (!ret) return false;
        } else if ((_debugMode > 0) && (_debugMode <=2) ) { // mimic verify_stream from mu2eUtil
            DTC_Data_Verifier verifier;
            
            TLOG(TLVL_INFO) << "Buffer Read " << std::dec << _event << std::endl;
            bool readSuccess = false;
	    bool timeout = false;
	    bool verified = false;
	    size_t sts = 0;
	    unsigned buffers_read = 1;
            auto device = theInterface_->GetDevice();
	    mu2e_databuff_t* buffer = readDTCBuffer(device, readSuccess, timeout, sts, false);

            if (timeout) TLOG(TLVL_ERROR) << "Timeout detected in event " << _event << ".";

            Utilities::PrintBuffer(buffer, sts, 2);

            if (_debugMode > 1) {
		    void* readPtr = &buffer[0];
		    uint16_t bufSize = static_cast<uint16_t>(*static_cast<uint64_t*>(readPtr));
		    readPtr = static_cast<uint8_t*>(readPtr) + 8;

		    DTC_Event evt(readPtr);
		    size_t eventByteCount = evt.GetEventByteCount();
		    size_t subEventCount = 0;
		    if (eventByteCount > bufSize - 8U) {
			DTC_Event newEvt(eventByteCount);
			memcpy(const_cast<void*>(newEvt.GetRawBufferPointer()), evt.GetRawBufferPointer(), bufSize - 8);
			size_t newEvtSize = bufSize - 8;
			while (newEvtSize < eventByteCount) {
			    TLOG(TLVL_TRACE) << "Reading continued DMA, current size " << newEvtSize << " / " << eventByteCount;
			    buffer = readDTCBuffer(device, readSuccess, timeout, sts, true);
			    if (!readSuccess) {
				TLOG(TLVL_ERROR) << "Unable to receive continued DMA! Aborting!";
				break;
			    }
			    readPtr = &buffer[0];
			    bufSize = static_cast<uint16_t>(*static_cast<uint64_t*>(readPtr));
			    readPtr = static_cast<uint8_t*>(readPtr) + 8;
			    buffers_read++;

			    size_t bytes_to_read = bufSize - 8;
			    if (newEvtSize + bufSize - 8 > eventByteCount) { bytes_to_read = eventByteCount - newEvtSize; }
			    memcpy(const_cast<uint8_t*>(static_cast<const uint8_t*>(newEvt.GetRawBufferPointer()) + newEvtSize), readPtr, bytes_to_read);
			    newEvtSize += bufSize - 8;
			}

			if (!readSuccess) {
			    TLOG(TLVL_ERROR) << "Read failed!";
			    return false;
			}

			newEvt.SetupEvent();
			subEventCount = newEvt.GetSubEventCount();


			verified = verifier.VerifyEvent(newEvt);
		     } else {
			evt.SetupEvent();
			subEventCount = evt.GetSubEventCount();
			verified = verifier.VerifyEvent(evt);
		     }

		     if (verified) {
			 TLOG(TLVL_INFO) << "Event verified successfully, " << subEventCount << " sub-events";
		     } else {
			 TLOG(TLVL_WARNING) << "Event verification failed!";
		     }
             }
             device->read_release(DTC_DMA_Engine_DAQ, buffers_read);   
             return true;  
        } else if (_debugMode >= 3) { // replicate getNextDTCFragment, but with more debug outputs
            DTC_EventWindowTag ts_in(_event);
            auto before_read = std::chrono::steady_clock::now();
            int retryCount = 5;
            std::vector<std::unique_ptr<DTCLib::DTC_Event>> data;
            while (data.size() == 0 && retryCount >= 0) {
                // TODO: how to know if we get a timeout? 
                try { data = theInterface_->GetData(ts_in); }
                catch (std::exception const& ex) {
                    TLOG(TLVL_ERROR) << "There was an error in the DTC Library: " << ex.what();
                }
                retryCount--;
            }
            if (retryCount < 0 && data.size() == 0) {
                // rise alarm in the DAQ if there is no data
                message("alarm", "GetData failed 5 times, no data in event " + std::to_string(_event));
                return false;
            }
            auto after_read = std::chrono::steady_clock::now();
            DTC_EventWindowTag ts_out = data[0]->GetEventWindowTag();
            if (ts_out.GetEventWindowTag(true) != ts_in.GetEventWindowTag(true)) {
                TLOG(TLVL_ERROR) << "Requested timestamp " << ts_in.GetEventWindowTag(true) << ", received data with timestamp " << ts_out.GetEventWindowTag(true);
                // TODO: how to let the DAQ know about this?
            }
            if (print_packets_) {
                for (auto& evt : data) {
                    for (size_t se = 0; se < evt->GetSubEventCount(); ++se) {
                        auto subevt = evt->GetSubEvent(se);
                        for (size_t bl = 0; bl < subevt->GetDataBlockCount(); ++bl) {
                           auto block = subevt->GetDataBlock(bl);
                           auto first = block->GetHeader();
                           TLOG(TLVL_INFO) << first->toJSON();
                           for (int ii = 0; ii < first->GetPacketCount(); ++ii) {
                              TLOG(TLVL_INFO) << DTCLib::DTC_DataPacket(((uint8_t*)block->blockPointer) + ((ii + 1) * 16)).toJSON() << std::endl;
                           }
                        }
                    }
                }
            }
            if (_check_if_valid) {
                if (data.size() != 1) {
                    message("error", "Number of fragements of " + std::to_string(data.size())+" != 1.");
                } else {                
                    if (data[0]->GetSubEventCount() != 1) {
                        message("error", "Number of subevents of " + std::to_string(data[0]->GetSubEventCount())+" != 1.");
                    } else {
                        auto subevt = data[0]->GetSubEvent(0);
                        auto header = subevt->GetDataBlock(0)->GetHeader();
                        if(!header->isValid()) {
                             message("error", "Got not valid data with "+std::to_string(header->GetByteCount())+
                                             " bytes and status '" + std::to_string(header->GetStatus())+"'");
                        }
                   }
                }
            }

            if (data.size() == 1) {     
                if (_verify_event) {
	            data[0]->SetupEvent();
                    DTC_Data_Verifier verifier; // move outside of getNext?
	            auto verified = verifier.VerifyEvent(*(data[0]));;
                    if (verified) { TLOG(TLVL_INFO) << "Event verified successfully, " << _event << " sub-events";
	            } else { TLOG(TLVL_WARNING) << "Event verification failed!"; }
                }
 
                TLOG(TLVL_DEBUG) << "Creating Fragment, sz=" << data[0]->GetEventByteCount();
                frags.emplace_back(new artdaq::Fragment(getCurrentSequenceID(), fragment_ids_[0], FragmentType::DTCEVT, ts_out.GetEventWindowTag(true)));
                frags.back()->resizeBytes(data[0]->GetEventByteCount());
                memcpy(frags.back()->dataBegin(), data[0]->GetRawBufferPointer(), data[0]->GetEventByteCount());
            } else { // SC, I think we don't need this for the CRV at all?    
                TLOG(TLVL_DEBUG) << "Creating ContainerFragment, sz=" << data.size();
                frags.emplace_back(new artdaq::Fragment(getCurrentSequenceID(), fragment_ids_[0]));
                frags.back()->setTimestamp(ts_out.GetEventWindowTag(true));
                artdaq::ContainerFragmentLoader cfl(*frags.back());
                cfl.set_missing_data(false);
                
                for (auto& evt : data) {       
                        TLOG(TLVL_DEBUG) << "Creating Fragment, sz=" << data[0]->GetEventByteCount();
                        artdaq::Fragment frag(getCurrentSequenceID(), fragment_ids_[0], FragmentType::DTCEVT, ts_out.GetEventWindowTag(true));
                        frag.resizeBytes(evt->GetEventByteCount());
                        memcpy(frags.back()->dataBegin(), evt->GetRawBufferPointer(), evt->GetEventByteCount());
                        cfl.addFragment(frag);
                }
            }

            auto after_copy = std::chrono::steady_clock::now();
            TLOG(TLVL_TRACE + 20) << "Incrementing event counter";
            ev_counter_inc();

            TLOG(TLVL_TRACE + 20) << "Reporting Metrics";
            auto hwTime = theInterface_->GetDevice()->GetDeviceTime();

            double hw_timestamp_rate = 1 / hwTime;
            double hw_data_rate = frags.back()->sizeBytes() / hwTime;

            metricMan->sendMetric("DTC Read Time", artdaq::TimeUtils::GetElapsedTime(after_read, after_copy), "s", 3, artdaq::MetricMode::Average);
            metricMan->sendMetric("Fragment Prep Time", artdaq::TimeUtils::GetElapsedTime(before_read, after_read), "s", 3, artdaq::MetricMode::Average);
            metricMan->sendMetric("HW Timestamp Rate", hw_timestamp_rate, "timestamps/s", 1, artdaq::MetricMode::Average);
            metricMan->sendMetric("PCIe Transfer Rate", hw_data_rate, "B/s", 1, artdaq::MetricMode::Average);

        }      

        /* debugging of getNextDTCFragment below

        bool readSuccess = false;
        bool timeout = false;
	size_t sts = 0;
	mu2e_databuff_t* buffer = readDTCBuffer(_device, readSuccess, timeout, sts, false);
        _device->read_release(DTC_DMA_Engine_DAQ, 1);
        
        //_device->release_all(DTC_DMA_Engine_DAQ);
       
        if(timeout) {
            TLOG(TLVL_ERROR) << "Timeout detected at event" << _event << ".";
        }

        DTCLib::Utilities::PrintBuffer(buffer, sts, 2);

        // and generate fragment
        */

        std::this_thread::sleep_for(std::chrono::milliseconds(_sleepAfterGetNext));
	return true;
}

bool mu2e::CRVVstReceiver::message(std::string msg_type, std::string message) {
    
    auto _xmlrpcUrl = "http://" + _tfm_host + ":" + std::to_string((10000 +1000 * GetPartitionNumber()))+"/RPC2";

    xmlrpc_client_call(&_env, _xmlrpcUrl.c_str(), "message","(ss)", msg_type.c_str(), (artdaq::Globals::app_name_+":"+message).c_str());
    if (_env.fault_occurred) {
        TLOG(TLVL_ERROR) << "XML-RPC rc=" << _env.fault_code << " " << _env.fault_string << " in CRVVstReceiver::message";
        return false;
    }
    return true;
}

mu2e_databuff_t* mu2e::CRVVstReceiver::readDTCBuffer(mu2edev* device, bool& readSuccess, bool& timeout, size_t& sts, bool continuedMode)
{
	mu2e_databuff_t* buffer;
	auto tmo_ms = 1500;
	readSuccess = false;
	TLOG(TLVL_TRACE) << "util - before read for DAQ";
	sts = theInterface_->GetDevice()->read_data(DTC_DMA_Engine_DAQ, reinterpret_cast<void**>(&buffer), tmo_ms);
	TLOG(TLVL_TRACE) << "util - after read for DAQ sts=" << sts << ", buffer=" << (void*)buffer;

	if (sts > 0)
	{
		readSuccess = true;
		void* readPtr = &buffer[0];
		uint16_t bufSize = static_cast<uint16_t>(*static_cast<uint64_t*>(readPtr));
		readPtr = static_cast<uint8_t*>(readPtr) + 8;
		TLOG((TLVL_INFO)) << "Buffer reports DMA size of " << std::dec << bufSize << " bytes. Device driver reports read of "
			<< sts << " bytes," << std::endl;

		TLOG(TLVL_TRACE) << "util - bufSize is " << bufSize;
		//if (binaryFileOutput)
		//{
		//	uint64_t dmaWriteSize = sts + 8;
		//	outputStream.write(reinterpret_cast<char*>(&dmaWriteSize), sizeof(dmaWriteSize));
		//	outputStream.write(reinterpret_cast<char*>(&buffer[0]), sts);
		//}
		//else if (rawOutput) {
		//	outputStream.write(static_cast<char*>(readPtr), sts - 8);
		//}

		timeout = false;
		if (sts > sizeof(DTC_EventHeader) + sizeof(DTC_SubEventHeader) + 8) {
			// Check for dead or cafe in first packet
			readPtr = static_cast<uint8_t*>(readPtr) + sizeof(DTC_EventHeader) + sizeof(DTC_SubEventHeader);
			std::vector<size_t> wordsToCheck{ 1, 2, 3, 7, 8 };
			for (auto& word : wordsToCheck)
			{
				auto wordPtr = static_cast<uint16_t*>(readPtr) + (word - 1);
				TLOG(TLVL_TRACE + 1) << word << (word == 1 ? "st" : word == 2 ? "nd"
					: word == 3 ? "rd"
					: "th")
					<< " word of buffer: " << *wordPtr;
				if (*wordPtr == 0xcafe || *wordPtr == 0xdead)
				{
					TLOG(TLVL_WARNING) << "Buffer Timeout detected! " << word << (word == 1 ? "st" : word == 2 ? "nd"
						: word == 3 ? "rd"
						: "th")
						<< " word of buffer is 0x" << std::hex << *wordPtr;
					Utilities::PrintBuffer(readPtr, 16, 0, TLVL_TRACE + 3);
					timeout = true;
					break;
				}
			}
		}
	}
	return buffer;
}

// The following macro is defined in artdaq's GeneratorMacros.hh header
DEFINE_ARTDAQ_COMMANDABLE_GENERATOR(mu2e::CRVVstReceiver)
