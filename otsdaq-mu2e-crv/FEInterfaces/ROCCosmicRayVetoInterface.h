#ifndef _ots_ROCCosmicRayVetoInterface_h_
#define _ots_ROCCosmicRayVetoInterface_h_

#include "dtcInterfaceLib/DTC.h"
#include "otsdaq-mu2e/ROCCore/ROCCoreVInterface.h"
#include <sstream>
#include <string>

namespace ots {

class ROCCosmicRayVetoInterface : public ROCCoreVInterface {

public:
  ROCCosmicRayVetoInterface(const std::string &rocUID,
                            const ConfigurationTree &theXDAQContextConfigTree,
                            const std::string &interfaceConfigurationPath);

  ~ROCCosmicRayVetoInterface(void);

  // state machine
  //----------------
  void configure(void);
  void halt(void);
  void pause(void);
  void resume(void);
  void start(std::string runNumber);
  void stop(void);
  bool running(void);

  // write and read to registers
  virtual void writeROCRegister(unsigned address,
                                unsigned data_to_write) override;
  virtual int readROCRegister(unsigned address) override;
  virtual void writeEmulatorRegister(unsigned address,
                                     unsigned data_to_write) override;
  virtual int readEmulatorRegister(unsigned address) override;

  // specific ROC functions
  virtual int readTimestamp() override;
  virtual void writeDelay(unsigned delay) override; // 5ns steps
  virtual int readDelay() override;                 // 5ns steps

  virtual int readDTCLinkLossCounter() override;
  virtual void resetDTCLinkLossCounter() override;
};

} // namespace ots

#endif