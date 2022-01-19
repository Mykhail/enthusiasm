const { createMessageAdapter } = require('@slack/interactive-messages');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackInteractions = createMessageAdapter(slackSigningSecret);
const networkSelect = require('../elements/networkselect.json');
const botHandler = require('./botHandler.js');

module.exports.listenForInteractions = function (app) {
  app.use('/interactions', slackInteractions.requestListener());
};

slackInteractions.action({ type: 'select' }, (payload, respond) => {
  const selectedOption = payload.actions[0].selected_options[0].value;

  if (payload.callback_id == 'botoptions') {
    switch (selectedOption) {
      case 'near_wallet_login':
        let text = 'Please select a network';
        let callbackId = 'near_wallet_login';
        selectNetwork(text, callbackId, respond);
        break;
      case 'near_bot_about':
        respond({
          text: 'Near bot about',
          attachments: [networkSelect],
          replace_original: true
        });
        break
    }
  }

  return { text: 'Processing...' }
});

slackInteractions.action({ type: 'button' }, (payload, respond) => {
  botHandler.respond(payload, respond)
});

slackInteractions.action({ type: 'plain_text_input' }, (payload, respond) => {
	payload.callback_id = "mainnet_account_input";
	console.log("payload", payload);
	botHandler.respond(payload, respond)
});

function selectNetwork(text, callbackId, respond) {
  networkSelect.callback_id = callbackId;

  respond({
    text: text,
    attachments: [networkSelect],
    replace_original: true
  })
}
