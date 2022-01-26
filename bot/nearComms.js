const { connect, transactions, keyStores, utils } = require("near-api-js");
const getConfig = require('../src/config.js');
const nearConfig = getConfig(process.env.NEAR_ENV || 'testnet');
const CONTRACT_NAME = nearConfig.contractName;
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(nearConfig.credentialsPath);

const config = {
    keyStore,
    networkId: nearConfig.networkId,
    nodeUrl: nearConfig.nodeUrl,
};

// callMethod('set_data', JSON.stringify({data: 'Some string'}));
// callMethod('get_data', '');
async function callMethod(methodName, stringifiedParams) {
    const near = await connect({ ...config, keyStore });
    const account = await near.account(CONTRACT_NAME);
    const result = await account.signAndSendTransaction({
        receiverId: CONTRACT_NAME,
        actions: [
            transactions.functionCall(
                methodName,
                Buffer.from(stringifiedParams),
                10000000000000,
                "0"
            ),
        ],
    });

    return Buffer.from(result.status.SuccessValue, 'base64').toString();
}

async function sendMoney(amountInNear) {
    const near = await connect({ ...config, keyStore });
    const account = await near.account(CONTRACT_NAME);

    const result = await account.signAndSendTransaction({
        receiverId: 'sub.chokobear.testnet',
        actions: [
            transactions.transfer(utils.format.parseNearAmount(String(amountInNear))),
        ],
    });

    return Buffer.from(result.status.SuccessValue, 'base64').toString();
}

module.exports = {
    callMethod: callMethod,
    sendMoney: sendMoney
};
