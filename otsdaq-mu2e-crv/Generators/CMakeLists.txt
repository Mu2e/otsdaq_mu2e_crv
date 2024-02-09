include_directories($ENV{XMLRPC_C_INCLUDE_DIR})
link_directories($ENV{MESSAGEFACILITY_LIB})
link_directories($ENV{FHICLCPP_LIB})
link_directories($ENV{CETLIB_LIB})
link_directories($ENV{CETLIB_EXCEPT_LIB})
link_directories($ENV{XMLRPC_C_FQ_DIR}/lib)
include(artdaq::commandableGenerator)

  
cet_build_plugin(CRVVstReceiver artdaq::commandableGenerator LIBRARIES REG xmlrpc_client xmlrpc xmlrpc_util artdaq_mu2e::artdaq-mu2e_Generators_Mu2eReceiverBase)



#get_cmake_property(_variableNames VARIABLES)
#foreach (_variableName ${_variableNames})
#    message(STATUS "${_variableName}=${${_variableName}}")
#endforeach()

install_headers()
install_source()
