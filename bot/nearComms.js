const { connect, transactions, keyStores, utils, providers } = require("near-api-js");
const getConfig = require('../src/config.js');
const nearConfig = getConfig(process.env.NEAR_ENV || 'testnet');
const CONTRACT_NAME = nearConfig.contractName;
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(nearConfig.credentialsPath);

const config = {
    keyStore,
    networkId: nearConfig.networkId,
    nodeUrl: nearConfig.nodeUrl,
};

function parseDepositResult(transaction) {
    let deposit;
    try {
        const rawDeposit = transaction.actions[0].Transfer.deposit;
        const valueInNear = utils.format.formatNearAmount(rawDeposit);
        deposit = parseFloat(valueInNear);
    } catch (error) {
        deposit = null;
    }

    return deposit;
}

async function getDepositAmount(hash) /* -> float | null */ {
    if (!hash) return null;
    const near = await connect({ ...config, keyStore });
    const provider = near.connection.provider;

    const result = await provider.txStatus(hash, CONTRACT_NAME);
    let deposit = parseDepositResult(result.transaction);

    return deposit;
}

// callMethod('set_data', JSON.stringify({data: 'Some string'}));
// callMethod('get_data', '');
async function callMethod(methodName, stringifiedParams = '', deposit = '0') {
    const near = await connect({ ...config, keyStore });
    const account = await near.account(CONTRACT_NAME);
    const result = await account.signAndSendTransaction({
        receiverId: CONTRACT_NAME,
        actions: [
            transactions.functionCall(
                methodName,
                Buffer.from(stringifiedParams),
                10000000000000,
                utils.format.parseNearAmount(deposit)
            ),
        ],
    });

    return Buffer.from(result.status.SuccessValue, 'base64').toString().replace(/^["']|["']$/gu, '');
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
    getDepositAmount: getDepositAmount,
    callMethod: callMethod,
    sendMoney: sendMoney
};
