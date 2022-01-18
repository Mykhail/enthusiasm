function respond(payload, respond) {
	switch (payload.callback_id) {
    case 'near_wallet_login':
      nearWalletLogin(payload.actions[0].value, respond);
      break;
    case 'near_bot_about':
      nearBotAbout(payload.actions[0].value, respond);
      break;
		case 'mainnet_account_input':
			console.log("mainnet_account_input trigger");

			respond({
				text: "Please authorize this bot in your NEAR account by following the URL - https://wallet.testnet.near.org/",
				replace_original: true
			});

			break;
  }
  
  return { text: 'Processing...' }
}

function nearWalletLogin(selectedOption, respond) {
  const mainNet = require('../elements/mainnet.json');
  const testNet = require('../elements/testnet.json');

  if (selectedOption == 'main') {
    respond({
      blocks: mainNet,
      replace_original: true
    })
  }
  else {
    respond({
      blocks: testNet,
      replace_original: true
    })
  }
}

function nearBotAbout(selectedOption, respond) {
  const aboutBot = require('../elements/aboutbot.json');

  respond({
    blocks: aboutBot,
    replace_original: true
  })
}

module.exports.respond = respond
