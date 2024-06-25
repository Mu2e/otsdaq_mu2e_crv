#include "otsdaq-mu2e-crv/FEInterfaces/ROCCosmicRayVetoInterface.h"
#include "otsdaq-mu2e-crv/FEInterfaces/ROC_Registers.h"

#include "otsdaq/Macros/InterfacePluginMacros.h"

using namespace ots;

#undef __MF_SUBJECT__
#define __MF_SUBJECT__ "FE-ROCCosmicRayVetoInterface"

//=========================================================================================
ROCCosmicRayVetoInterface::ROCCosmicRayVetoInterface(
    const std::string&       rocUID,
    const ConfigurationTree& theXDAQContextConfigTree,
    const std::string&       theConfigurationPath)
    : ROCCoreVInterface(rocUID, theXDAQContextConfigTree, theConfigurationPath)
{
	INIT_MF("." /*directory used is USER_DATA/LOG/.*/);

	__MCOUT_INFO__("ROCCosmicRayVetoInterface instantiated with link: "
	               << (int)linkID_ << " and EventWindowDelayOffset = " << delay_ << __E__);

	registerFEMacroFunction(
		"Do the CRV Dance",
			static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::DoTheCRV_Dance),
					std::vector<std::string>{"Which Step"},
					std::vector<std::string>{						
						"Random Result"},
					1);  // requiredUserPermissions

	registerFEMacroFunction("Get Firmware Version",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::GetFirmwareVersion),
					std::vector<std::string>{},
					std::vector<std::string>{"version", "git hash"},
					1);  // requiredUserPermissions

	registerFEMacroFunction("Get Test Counter",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::GetTestCounter),
					std::vector<std::string>{},
					std::vector<std::string>{"counter"},
					1);  // requiredUserPermissions

	registerFEMacroFunction("Set Test Counter",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::SetTestCounter),
					std::vector<std::string>{"Set Counter (Default: 0)"},
					std::vector<std::string>{},
					1);  // requiredUserPermissions

    	registerFEMacroFunction("Reset uC",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::HardReset),
					std::vector<std::string>{},
					std::vector<std::string>{},
					1);  // requiredUserPermissions

    	registerFEMacroFunction("Configure ROC",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::RocConfigure),
					std::vector<std::string>{"send GR packages (Default: true)"},
					std::vector<std::string>{},
					1);  // requiredUserPermissions

		registerFEMacroFunction("Reset TX and Counters",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::SoftReset),
					std::vector<std::string>{},
					std::vector<std::string>{},
					1);  // requiredUserPermissions

        registerFEMacroFunction("Get Status",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::GetStatus),
					std::vector<std::string>{},
					std::vector<std::string>{
					"version", "git hash",
					"CR", "Send GR", "Loopback Mode", "PLL lock", "Active Ports", "Uptime", "Link Errors Loss", "Link Errors CRC", 
					"Test Cnt", "Marker Decoded Cnt", "Marker Delayed Cnt", "Heartbeat Rx Cnt", "Heartbeat Tx Cnt", "DR Cnt", "Injection Cnt", "Loopback Markers (fiber) Cnt",
					"Last Event Length (12.5ns)", "Injection Length (12.5ns)", "Injection Timestamp"
					},
					1);  // requiredUserPermissions

        registerFEMacroFunction("Read Fiber Rx",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::FiberRx),
					std::vector<std::string>{"number of packages (Default: 10)"},
					std::vector<std::string>{"buffer"},
					1);  // requiredUserPermissions

		registerFEMacroFunction("Read Fiber Tx",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::FiberTx),
					std::vector<std::string>{"number of packages (Default: 10)"},
					std::vector<std::string>{"buffer"},
					1);  // requiredUserPermissions
				
		registerFEMacroFunction("Set Loopback Mode",
	    static_cast<FEVInterface::frontEndMacroFunction_t>(
					&ROCCosmicRayVetoInterface::SetLoopbackMode),
					std::vector<std::string>{"loopback mode (Default: 0)"},
					std::vector<std::string>{},
					1);  // requiredUserPermissions

}

//==========================================================================================
ROCCosmicRayVetoInterface::~ROCCosmicRayVetoInterface(void)
{
	// NOTE:: be careful not to call __FE_COUT__ decoration because it uses the
	// tree and it may already be destructed partially
	__COUT__ << FEVInterface::interfaceUID_ << " Destructor" << __E__;
}

////==================================================================================================
//void ROCCosmicRayVetoInterface::writeROCRegister(uint16_t address, uint16_t data_to_write)
//{
//	__FE_COUT__ << "Calling write ROC register: link number " << std::dec << (int)linkID_
//	            << ", address = " << address << ", write data = " << data_to_write
//	            << __E__;
//
//	return;
//}
//
////==================================================================================================
//uint16_t ROCCosmicRayVetoInterface::readROCRegister(uint16_t address)
//{
//	__FE_COUT__ << "Calling read ROC register: link number " << std::dec << linkID_
//	            << ", address = " << address << __E__;
//
//	return -1;
//}
//
//============================================================================================
void ROCCosmicRayVetoInterface::writeEmulatorRegister(uint16_t address,
                                                      uint16_t data_to_write)
{
	__FE_COUT__ << "Calling write ROC Emulator register: link number " << std::dec
	            << (int)linkID_ << ", address = " << address
	            << ", write data = " << data_to_write << __E__;

	return;
}

//==================================================================================================
uint16_t ROCCosmicRayVetoInterface::readEmulatorRegister(uint16_t address)
{
	__FE_COUT__ << "Calling read ROC Emulator register: link number " << std::dec
	            << (int)linkID_ << ", address = " << address << __E__;

	return -1;
}

////==================================================================================================
//int ROCCosmicRayVetoInterface::readTimestamp() { return this->readRegister(12); }

////==================================================================================================
//void ROCCosmicRayVetoInterface::writeDelay(uint16_t delay)
//{
//	this->writeRegister(21, delay);
//	return;
//}

////==================================================================================================
//int ROCCosmicRayVetoInterface::readDelay() { return this->readRegister(7); }

////==================================================================================================
//int ROCCosmicRayVetoInterface::readDTCLinkLossCounter() { return this->readRegister(8); }

////==================================================================================================
//void ROCCosmicRayVetoInterface::resetDTCLinkLossCounter()
//{
//	this->writeRegister(24, 0x1);
//	return;
//}

//==================================================================================================
void ROCCosmicRayVetoInterface::configure(void) try
{
	__MCOUT_INFO__(".... do nothing for CRV ROC yet ... ");

	// __MCOUT_INFO__("......... Clear DCS FIFOs" << __E__);
}
catch(const std::runtime_error& e)
{
	__FE_MOUT__ << "Error caught: " << e.what() << __E__;
	throw;
}
catch(...)
{
	__FE_SS__ << "Unknown error caught. Check printouts!" << __E__;
	__FE_MOUT__ << ss.str();
	__FE_SS_THROW__;
}

//==============================================================================
void ROCCosmicRayVetoInterface::halt(void) {}

//==============================================================================
void ROCCosmicRayVetoInterface::pause(void) {}

//==============================================================================
void ROCCosmicRayVetoInterface::resume(void) {}

//==============================================================================
void ROCCosmicRayVetoInterface::start(std::string)  // runNumber)
{
}

//==============================================================================
void ROCCosmicRayVetoInterface::stop(void) {}

//==============================================================================
bool ROCCosmicRayVetoInterface::running(void) { return false; }

//========================================================================
void ROCCosmicRayVetoInterface::DoTheCRV_Dance(__ARGS__)
{	
//	uint32_t address = __GET_ARG_IN__("Which Step", uint32_t);
	__FE_COUT__ << "Hello" << __E__;
	__SET_ARG_OUT__("Random Result",0xA4);
	
} //end DoTheCRV_Dance()

void ROCCosmicRayVetoInterface::GetFirmwareVersion(__ARGS__)
{	
	__SET_ARG_OUT__("version", this->readRegister(ROCLib::ROC_Register::Version));
	__SET_ARG_OUT__("git hash", 
	    (this->readRegister(ROCLib::ROC_Register::GitHashHigh) << 16) +
		this->readRegister(ROCLib::ROC_Register::GitHashLow)
	);
} //end GetFirmwareVersion()

void ROCCosmicRayVetoInterface::GetTestCounter(__ARGS__)
{	
	__SET_ARG_OUT__("counter", this->readRegister(ROCLib::ROC_Register::TestCounter));
} //end GetTestCounter()

void ROCCosmicRayVetoInterface::SetTestCounter(__ARGS__)
{	
	uint16_t value = __GET_ARG_IN__("Set Counter (Default: 0)", uint16_t, 0);
	this->writeRegister(ROCLib::ROC_Register::TestCounter, value);
} //end SetTestCounter()

void ROCCosmicRayVetoInterface::Reset() {
	this->writeRegister(ROCLib::ROC_Register::Reset, 0x1);
}
void ROCCosmicRayVetoInterface::HardReset(__ARGS__) { Reset(); }

void  ROCCosmicRayVetoInterface::ResetTxBuffers() {
   this->writeRegister(ROCLib::ROC_Register::GTP_CRC, 0x1);
   this->writeRegister(ROCLib::ROC_Register::CRS, 0x300);
}
void ROCCosmicRayVetoInterface::SoftReset(__ARGS__)
{
    ResetTxBuffers();
}

void ROCCosmicRayVetoInterface::RocConfigure(bool gr) {
	// Enable the onboard PLL
	this->writeRegister(ROCLib::ROC_Register::PLLStat,     0x0);
	// and configure PLL mux to read digital lock
	this->writeRegister(ROCLib::ROC_Register::PLLMuxHigh, 0x12);
	this->writeRegister(ROCLib::ROC_Register::PLLMuxHLow, 0x12);

	// enable package forwarding based on markers
	this->writeRegister(ROCLib::ROC_Register::CR, 0x20);

	// Set CSR of data-FPGAs
	this->writeRegister(ROCLib::ROC_Register::Data_Broadcast|ROCLib::ROC_Register::Data_CRC, 0xA8);

    // Reset input buffers
	ResetTxBuffers();

	// Reset DDR on Data FPGAs
	for (int i = 0; i < 3; ++i) {
	    this->writeRegister(ROCLib::ROC_Register_Data[i]|ROCLib::ROC_Register::Data_DDR_WriteHigh,0x0);
	    this->writeRegister(ROCLib::ROC_Register_Data[i]|ROCLib::ROC_Register::Data_DDR_WriteHigh,0x0);
	    this->writeRegister(ROCLib::ROC_Register_Data[i]|ROCLib::ROC_Register::Data_DDR_ReadHigh, 0x0);
	    this->writeRegister(ROCLib::ROC_Register_Data[i]|ROCLib::ROC_Register::Data_DDR_ReadLow, 0x0);
	}

    // Set TRIG 1
	this->writeRegister(ROCLib::ROC_Register::TRIG, 0x1);

	// Enable GR package return
	if(gr) this->writeRegister(ROCLib::ROC_Register::sendGR, 0x1);
	else this->writeRegister(ROCLib::ROC_Register::sendGR, 0x0);

}
void ROCCosmicRayVetoInterface::RocConfigure(__ARGS__)
{
	bool gr = __GET_ARG_IN__("send GR packages (Default: true)", bool, true);
    RocConfigure(gr);
}

void ROCCosmicRayVetoInterface::GetStatus(__ARGS__)
{
    __SET_ARG_OUT__("version", this->readRegister(ROCLib::ROC_Register::Version));
	__SET_ARG_OUT__("git hash", 
	    ((this->readRegister(ROCLib::ROC_Register::GitHashHigh) << 16) +
		this->readRegister(ROCLib::ROC_Register::GitHashLow)) & 0xffffffff
	);
	__SET_ARG_OUT__("CR", this->readRegister(ROCLib::ROC_Register::CR));
	__SET_ARG_OUT__("Send GR", this->readRegister(ROCLib::ROC_Register::sendGR) & 0x1);
	__SET_ARG_OUT__("Loopback Mode", this->readRegister(ROCLib::ROC_Register::LoopbackMode));
	__SET_ARG_OUT__("PLL lock", ((this->readRegister(ROCLib::ROC_Register::PLLStat)) >> 4) & 0x1 );
	__SET_ARG_OUT__("Active Ports", 
	    (this->readRegister(ROCLib::ROC_Register::ActivePortsHigh) << 16) +
		this->readRegister(ROCLib::ROC_Register::ActivePortsLow));
	__SET_ARG_OUT__("Uptime", 
	    (this->readRegister(ROCLib::ROC_Register::UpTimeHigh) << 16) +
		this->readRegister(ROCLib::ROC_Register::UpTimeLow));
	__SET_ARG_OUT__("Link Errors Loss", this->readRegister(ROCLib::ROC_Register::LinkErrors) & 0xff);
	__SET_ARG_OUT__("Link Errors CRC", this->readRegister(ROCLib::ROC_Register::LinkErrors) >> 12);

	// Counters
	__SET_ARG_OUT__("Test Cnt", this->readRegister(ROCLib::ROC_Register::TestCounter));
	__SET_ARG_OUT__("Marker Decoded Cnt", this->readRegister(ROCLib::ROC_Register::MarkerCnt) & 0xff);
	__SET_ARG_OUT__("Marker Delayed Cnt", (this->readRegister(ROCLib::ROC_Register::MarkerCnt) >> 8));
	__SET_ARG_OUT__("Heartbeat Rx Cnt", this->readRegister(ROCLib::ROC_Register::HeartBeat) & 0xff);
	__SET_ARG_OUT__("Heartbeat Tx Cnt", this->readRegister(ROCLib::ROC_Register::HeartBeat) >> 8);
	__SET_ARG_OUT__("DR Cnt", 
	    (this->readRegister(ROCLib::ROC_Register::DRCntHigh) << 16) +
		this->readRegister(ROCLib::ROC_Register::DRCnLow));
	__SET_ARG_OUT__("Injection Cnt", this->readRegister(ROCLib::ROC_Register::InjectionCnt));
	__SET_ARG_OUT__("Loopback Markers (fiber) Cnt", this->readRegister(ROCLib::ROC_Register::LoopbackMarkerCnt));

	// Event Lengths
	__SET_ARG_OUT__("Last Event Length (12.5ns)", this->readRegister(ROCLib::ROC_Register::LastEventLength));
	__SET_ARG_OUT__("Injection Length (12.5ns)", this->readRegister(ROCLib::ROC_Register::InjectionLength));
	__SET_ARG_OUT__("Injection Timestamp", this->readRegister(ROCLib::ROC_Register::InjectionTS));
	
}

void ROCCosmicRayVetoInterface::FiberRx(__ARGS__) {
	int n = __GET_ARG_IN__("number of packages (Default: 10)", int, 10);

	std::stringstream o;
	o << std::endl;
	for(int i = 0; i < n; ++i) { // n packages
	    for(int k = 0; k < 10; ++k) { // 10 words per package
            o << std::hex << std::setfill('0') << std::setw(4) << this->readRegister(ROCLib::ROC_Register::GTPRxRead) << " ";
		}
		o << std::endl;
	}
	__SET_ARG_OUT__("buffer", o.str());
}

void ROCCosmicRayVetoInterface::FiberTx(__ARGS__) {
	int n = __GET_ARG_IN__("number of packages (Default: 10)", int, 10);

	std::stringstream o;
	o << std::endl;
	for(int i = 0; i < n; ++i) { // n packages
	    for(int k = 0; k < 10; ++k) { // 10 words per package
            o << std::hex << std::setfill('0') << std::setw(4) << this->readRegister(ROCLib::ROC_Register::GTPTxRead) << " ";
		}
		o << std::endl;
	}
	__SET_ARG_OUT__("buffer", o.str());
}

void ROCCosmicRayVetoInterface::SetLoopbackMode(__ARGS__) {
	int16_t mode = __GET_ARG_IN__("loopback mode (Default: 0)", int16_t, 0);
	this->writeRegister(ROCLib::ROC_Register::LoopbackMode, mode);
}

DEFINE_OTS_INTERFACE(ROCCosmicRayVetoInterface)