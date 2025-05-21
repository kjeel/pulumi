import * as azure from "@pulumi/azure-native";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";

// Konfiguration
const config = new pulumi.Config();
const username = "pulumiuser";
const password = config.requireSecret("adminPassword");

// Ressourcen-Gruppe
const resourceGroup = new azure.resources.ResourceGroup("SKCLAR_RITZ");

// Public IP
const publicIp = new azure.network.PublicIPAddress("web-ip", {
    resourceGroupName: resourceGroup.name,
    publicIPAllocationMethod: "Dynamic",
});

// Virtuelles Netzwerk + Subnetz
const vnet = new azure.network.VirtualNetwork("web-vnet", {
    resourceGroupName: resourceGroup.name,
    addressSpace: { addressPrefixes: ["10.0.0.0/16"] },
    subnets: [{
        name: "default",
        addressPrefix: "10.0.1.0/24",
    }],
});

const subnetId = vnet.subnets!.apply(subnets => subnets![0].id!);

// Netzwerkschnittstelle
const nic = new azure.network.NetworkInterface("web-nic", {
    resourceGroupName: resourceGroup.name,
    ipConfigurations: [{
        name: "ipconfig",
        subnet: { id: subnetId },
        privateIPAllocationMethod: "Dynamic",
        publicIPAddress: { id: publicIp.id },
    }],
});

// Benutzerdefiniertes Startskript
const startupScript = `#!/bin/bash
apt update
apt install -y apache2
echo "<!DOCTYPE html>
<html>
<head><title>IMA23 FH Joanneum</title></head>
<body>
  <h1>Wirtschaftsinformatik – IMA23</h1>
  <p>Team: Gruber, Ritz, Stocker</p>
</body>
</html>" > /var/www/html/index.html
systemctl enable apache2
systemctl start apache2
`;

// Virtuelle Maschine
const vm = new azure.compute.VirtualMachine("web-vm", {
    resourceGroupName: resourceGroup.name,
    networkProfile: {
        networkInterfaces: [{ id: nic.id }],
    },
    hardwareProfile: {
        vmSize: "Standard_B1s",
    },
    osProfile: {
        computerName: "webserver",
        adminUsername: username,
        adminPassword: password,
        linuxConfiguration: {
            disablePasswordAuthentication: false,
        },
        customData: Buffer.from(startupScript).toString("base64"),
    },
    storageProfile: {
        osDisk: {
            createOption: "FromImage",
            name: "web-osdisk",
        },
        imageReference: {
            publisher: "Canonical",
            offer: "UbuntuServer",
            sku: "18.04-LTS",
            version: "latest",
        },
    },
});

// Exportiere IP Adresse
export const publicIpAddress = publicIp.ipAddress;
