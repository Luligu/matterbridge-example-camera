#
#    Commission a mode: 'server' device node into the Python test framework's fabric, unless it is already there,
#    then reset the state the previous tests left on it.
#
#    The luligu/matterbridge:chip-test image only pairs the Matterbridge bridge node (0x12344321). A device
#    registered with mode: 'server' is a separate Matter node with its own port, passcode and discriminator,
#    so the Python tests can reach it only after this helper commissions it under its own node id. The tests
#    then target it with --dut-node-id <node id>.
#
#    It is idempotent: if the node already answers on this fabric (a previous run commissioned it), it does not
#    commission it again, so chipTests.json can run it before every test that targets the node.
#
#    The CSA CI runs each test against a freshly started reference app. Here the tests share one node, so the
#    helper then resets what a previous (possibly failed) test can leave behind and break the next one:
#
#      - an armed fail-safe (it disarms it);
#      - the fabrics other than its own, e.g. the CR2 fabric of a multi-fabric test (it removes them);
#      - on its own fabric, the TLS endpoints, client certificates and root certificates of the TLS Client
#        Management and TLS Certificate Management clusters, when the node has them (it removes them);
#      - the DSTOffset and TimeZone lists of the Time Synchronization cluster, when the node has it (it sets an
#        empty DSTOffset and a single TimeZone with offset 0, as on a factory new node).
#
#    Run through scripts/run-chip-tests.mjs (see chipTests.json), or by hand inside the container:
#
#      python3 /root/Matterbridge/matterbridge-example-camera/scripts/chip/commission_node.py \
#        --dut-node-id 0x12344322 --int-arg passcode:20252030 --int-arg discriminator:3540
#
#    Arguments:
#
#      --dut-node-id <n>              Required. Node id to give the node on this fabric.
#      --int-arg passcode:<n>         Required. Setup passcode of the node (logged by Matterbridge as
#                                     "Creating server node for <name> on port <port> with passcode <n> ...").
#      --int-arg discriminator:<n>    Required. Long discriminator of the node (same log line).
#

import logging

import matter.clusters as Clusters
from matter import ChipDeviceCtrl
from matter.discovery import FilterType
from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main
from mobly import asserts


class CommissionNode(MatterBaseTest):
    # A harness helper, not a conformance test: no background wildcard subscription to cross-check its reads against.
    disable_wildcard_subscription = True

    @async_test_body
    async def test_commission_node(self):
        node_id = self.dut_node_id
        passcode = self.user_params.get("passcode")
        discriminator = self.user_params.get("discriminator")
        asserts.assert_is_not_none(passcode, "Missing --int-arg passcode:<n>")
        asserts.assert_is_not_none(discriminator, "Missing --int-arg discriminator:<n>")

        try:
            await self.default_controller.GetConnectedDevice(nodeId=node_id, allowPASE=False, timeoutMs=10000)
            node_label = await self.read_single_attribute_check_success(
                cluster=Clusters.BasicInformation, attribute=Clusters.BasicInformation.Attributes.NodeLabel, node_id=node_id, endpoint=0)
            logging.info(f"Node 0x{node_id:X} ({node_label}) is already commissioned on this fabric")
        except Exception as error:
            logging.info(f"Node 0x{node_id:X} is not reachable on this fabric ({error}): commissioning it")
            await self.default_controller.CommissionOnNetwork(
                nodeId=node_id, setupPinCode=passcode, filterType=FilterType.LONG_DISCRIMINATOR, filter=discriminator)
            logging.info(f"Node 0x{node_id:X} commissioned on this fabric")

        # A test that fails while adding a fabric leaves the fail-safe armed, and every later AddTrustedRootCertificate in it fails
        # with CONSTRAINT_ERROR: disarm it (only the fabric that armed it can, which is this one for the tests).
        response = await self.send_single_cmd(
            cmd=Clusters.GeneralCommissioning.Commands.ArmFailSafe(expiryLengthSeconds=0, breadcrumb=0), node_id=node_id, endpoint=0)
        logging.info(f"Disarmed the fail-safe of node 0x{node_id:X} (errorCode {response.errorCode})")

        # A test that fails before its cleanup leaves its extra fabric (e.g. CR2) on the node, and every later test that adds a
        # second fabric then fails on AddNOC with a fabric conflict: remove every fabric except this one.
        current_fabric_index = await self.read_single_attribute_check_success(
            cluster=Clusters.OperationalCredentials, attribute=Clusters.OperationalCredentials.Attributes.CurrentFabricIndex, node_id=node_id, endpoint=0)
        fabrics = await self.read_single_attribute_check_success(
            cluster=Clusters.OperationalCredentials, attribute=Clusters.OperationalCredentials.Attributes.Fabrics, node_id=node_id, endpoint=0,
            fabric_filtered=False)
        for fabric in fabrics:
            if fabric.fabricIndex == current_fabric_index:
                continue
            response = await self.send_single_cmd(
                cmd=Clusters.OperationalCredentials.Commands.RemoveFabric(fabricIndex=fabric.fabricIndex), node_id=node_id, endpoint=0)
            asserts.assert_equal(response.statusCode, Clusters.OperationalCredentials.Enums.NodeOperationalCertStatusEnum.kOk,
                                 f"RemoveFabric of the stale fabric {fabric.fabricIndex} failed")
            logging.info(f"Removed the stale fabric {fabric.fabricIndex} (fabric id {fabric.fabricID}) from node 0x{node_id:X}")

        server_list = await self.read_single_attribute_check_success(
            cluster=Clusters.Descriptor, attribute=Clusters.Descriptor.Attributes.ServerList, node_id=node_id, endpoint=0)
        if Clusters.TimeSynchronization.id in server_list:
            await self.send_single_cmd(cmd=Clusters.TimeSynchronization.Commands.SetDSTOffset(DSTOffset=[]), node_id=node_id, endpoint=0)
            await self.send_single_cmd(
                cmd=Clusters.TimeSynchronization.Commands.SetTimeZone(timeZone=[Clusters.TimeSynchronization.Structs.TimeZoneStruct(offset=0, validAt=0)]),
                node_id=node_id, endpoint=0)
            logging.info(f"Reset the DSTOffset and TimeZone of node 0x{node_id:X}")

        # The TLS commands have the Large Message quality: send them over a Large Message capable transport (TCP).
        large = ChipDeviceCtrl.TransportPayloadCapability.LARGE_PAYLOAD
        if Clusters.TlsClientManagement.id in server_list:
            # The TLS endpoints first: a certificate used by a TLS endpoint cannot be removed.
            endpoints = await self.read_single_attribute_check_success(
                cluster=Clusters.TlsClientManagement, attribute=Clusters.TlsClientManagement.Attributes.ProvisionedEndpoints, node_id=node_id,
                endpoint=0)
            for endpoint in endpoints:
                await self.send_single_cmd(cmd=Clusters.TlsClientManagement.Commands.RemoveEndpoint(endpointID=endpoint.endpointID),
                                           node_id=node_id, endpoint=0, payloadCapability=large)
                logging.info(f"Removed the stale TLS endpoint {endpoint.endpointID} from node 0x{node_id:X}")
        if Clusters.TlsCertificateManagement.id in server_list:
            client_certificates = await self.read_single_attribute_check_success(
                cluster=Clusters.TlsCertificateManagement, attribute=Clusters.TlsCertificateManagement.Attributes.ProvisionedClientCertificates,
                node_id=node_id, endpoint=0)
            for certificate in client_certificates:
                await self.send_single_cmd(cmd=Clusters.TlsCertificateManagement.Commands.RemoveClientCertificate(ccdid=certificate.ccdid),
                                           node_id=node_id, endpoint=0, payloadCapability=large)
                logging.info(f"Removed the stale client certificate {certificate.ccdid} from node 0x{node_id:X}")
            root_certificates = await self.read_single_attribute_check_success(
                cluster=Clusters.TlsCertificateManagement, attribute=Clusters.TlsCertificateManagement.Attributes.ProvisionedRootCertificates,
                node_id=node_id, endpoint=0)
            for certificate in root_certificates:
                await self.send_single_cmd(cmd=Clusters.TlsCertificateManagement.Commands.RemoveRootCertificate(caid=certificate.caid),
                                           node_id=node_id, endpoint=0, payloadCapability=large)
                logging.info(f"Removed the stale root certificate {certificate.caid} from node 0x{node_id:X}")


if __name__ == "__main__":
    default_matter_test_main()
