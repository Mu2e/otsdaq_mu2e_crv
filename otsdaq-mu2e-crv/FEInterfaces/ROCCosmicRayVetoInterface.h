#ifndef _ots_ROCCosmicRayVetoInterface_h_
#define _ots_ROCCosmicRayVetoInterface_h_

#include <sstream>
#include <string>
#include "dtcInterfaceLib/DTC.h"
#include "otsdaq-mu2e/ROCCore/ROCCoreVInterface.h"
#include "otsdaq-mu2e-crv/crvInterfaceLib/CRVROC.h"

namespace ots
{
class ROCCosmicRayVetoInterface : public ROCCoreVInterface
{
	// clang-format off
public:
	ROCCosmicRayVetoInterface(const std::string &rocUID,
							const ConfigurationTree &theXDAQContextConfigTree,
							const std::string &interfaceConfigurationPath);

	~ROCCosmicRayVetoInterface(void);

	// state machine
	//----------------
	void 									configure				(void) override;
	void 									halt					(void) override;
	void 									pause					(void) override;
	void 									resume					(void) override;
	void 									start					(std::string runNumber) override;
	void 									stop					(void) override;
	bool 									running					(void) override;

	// write and read to registers
	virtual void 							writeROCRegister		(uint16_t address, uint16_t data_to_write) override;
	virtual uint16_t  						readROCRegister			(uint16_t address) override;
	virtual void 							writeEmulatorRegister	(uint16_t address, uint16_t data_to_write) override;
	virtual uint16_t						readEmulatorRegister	(uint16_t address) override;

	virtual void 							readROCBlock			(std::vector<uint16_t>& data, uint16_t address, uint16_t numberOfReads, bool incrementAddress) override { }
	virtual void 							readEmulatorBlock		(std::vector<uint16_t>& data, uint16_t address, uint16_t numberOfReads, bool incrementAddress) override { }

    // used by slow controls
	void 									universalRead				(char* address, char* readValue) override;

	// specific ROC functions
	virtual int  							readTimestamp			(void) override;
	virtual void 							writeDelay				(uint16_t delay) override;  // 5ns steps
	virtual int  							readDelay				(void) override;            // 5ns steps

	virtual int  							readDTCLinkLossCounter	(void) override;
	virtual void 							resetDTCLinkLossCounter	(void) override;


private:
	CRVLib::CRVROC                       	roc_; 
	void									initRoc					(void);

public:
	void 									DoTheCRV_Dance			(__ARGS__);
	void 									ReadTestCouter			(__ARGS__);
	void 									SetActivePort			(__ARGS__);
	void 									GetActivePort			(__ARGS__);
	void 									GetActivePorts			(__ARGS__);
	// clang-format on
};

}  // namespace ots

#endif
