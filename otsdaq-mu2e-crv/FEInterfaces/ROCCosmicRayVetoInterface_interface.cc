#include "otsdaq-mu2e-crv/FEInterfaces/ROCCosmicRayVetoInterface.h"

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
}

//==========================================================================================
ROCCosmicRayVetoInterface::~ROCCosmicRayVetoInterface(void)
{
	// NOTE:: be careful not to call __FE_COUT__ decoration because it uses the
	// tree and it may already be destructed partially
	__COUT__ << FEVInterface::interfaceUID_ << " Destructor" << __E__;
}

//==================================================================================================
void ROCCosmicRayVetoInterface::writeROCRegister(uint16_t address, uint16_t data_to_write)
{
	__FE_COUT__ << "Calling write ROC register: link number " << std::dec << (int)linkID_
	            << ", address = " << address << ", write data = " << data_to_write
	            << __E__;

	return;
}

//==================================================================================================
uint16_t ROCCosmicRayVetoInterface::readROCRegister(uint16_t address)
{
	__FE_COUT__ << "Calling read ROC register: link number " << std::dec << linkID_
	            << ", address = " << address << __E__;

	return -1;
}

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

//==================================================================================================
int ROCCosmicRayVetoInterface::readInjectedPulseTimestamp()
{
	return this->readRegister(12);
}

//==================================================================================================
void ROCCosmicRayVetoInterface::writeDelay(uint16_t delay)
{
	this->writeRegister(21, delay);
	return;
}

//==================================================================================================
int ROCCosmicRayVetoInterface::readDelay() { return this->readRegister(7); }

//==================================================================================================
int ROCCosmicRayVetoInterface::readDTCLinkLossCounter() { return this->readRegister(8); }

//==================================================================================================
void ROCCosmicRayVetoInterface::resetDTCLinkLossCounter()
{
	this->writeRegister(24, 0x1);
	return;
}

//==================================================================================================
void ROCCosmicRayVetoInterface::configure(void) try
{
	__MCOUT_INFO__(".... do nothing for STM ROC... ");

	// __MCOUT_INFO__("......... Clear DCS FIFOs" << __E__);
	// this->writeRegister(0,1);
	// this->writeRegister(0,0);

	// setup needToResetAlignment using rising edge of register 22
	// (i.e., force synchronization of ROC clock with 40MHz system clock)
	//__MCOUT_INFO__("......... setup to synchronize ROC clock with 40 MHz clock
	// edge" << __E__);  this->writeRegister(22,0);  this->writeRegister(22,1);

	// this->writeDelay(delay_);
	// usleep(100);

	//__MCOUT_INFO__ ("........." << " Set delay = " << delay_ << ", readback = "
	//<< this->readDelay() << " ... ");

	//__FE_COUT__ << "Debugging ROC-DCS" << __E__;

	// unsigned int val;

	// read 6 should read back 0x12fc
	// for (int i = 0; i<1; i++)
	//{
	//	val = this->readRegister(6);
	//
	//	//__MCOUT_INFO__(i << " read register 6 = " << val << __E__);
	//	if(val != 4860)
	//	{
	//		__FE_SS__ << "Bad read not 4860! val = " << val << __E__;
	//		__FE_SS_THROW__;
	//	}
	//
	//	val = this->readDelay();
	//	//__MCOUT_INFO__(i << " read register 7 = " << val << __E__);
	//	if(val != delay_)
	//	{
	//		__FE_SS__ << "Bad read not " << delay_ << "! val = " << val <<
	//__E__;
	//		__FE_SS_THROW__;
	//	}
	//}

	// if(0) //random intense check
	//{
	//	highRateCheck();
	//}

	//__MCOUT_INFO__ ("......... reset DTC link loss counter ... ");
	// resetDTCLinkLossCounter();
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

DEFINE_OTS_INTERFACE(ROCCosmicRayVetoInterface)
