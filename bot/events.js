const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const userLoggedIn = true;
const token = process.env.SLACK_BOT_TOKEN;

const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const { createMessageAdapter } = require('@slack/interactive-messages');

const web = new WebClient(token);
const botHandler = require('./botHandler.js');
const botOptions = require('../elements/botoptions.json');
const userRewards = require('../elements/userrewards.json');
const networkSelect = require('../elements/networkselect.json');

const slackEventAdapter = createEventAdapter(slackSigningSecret);
const slackBotInteractions = createMessageAdapter(slackSigningSecret);

function listenForEvents(app) {
  app.use('/events', slackEventAdapter.requestListener());
	app.use('/interactions', slackBotInteractions.requestListener());

  slackEventAdapter.on('app_mention', (event) => {
    console.log(`Received an app_mention event from user ${event.user} in channel ${event.channel}`);
    appMentionedHandler(event)
  });

	slackEventAdapter.on("reaction_added", async (event) => {
		if(event.reaction == "near_icon") {
			reactionAddedHandler(event, userLoggedIn)
		}
	});

  slackEventAdapter.on('error', (error) => {
    console.log(`error: ${error}`)
  })
}

async function appMentionedHandler(event) {
  try {
		await web.chat.postEphemeral({
      channel: event.channel,
			user: event.user,
      attachments: [botOptions]
    });
  } catch (error) {
    console.log(error);
  }
}

async function reactionAddedHandler(event, userLoggedIn) {
	try {
			await web.chat.postEphemeral({
				channel: event.item.channel,
				user: event.user,
				text: userLoggedIn ? "" : 'It seems you are not authorized yet, what you would like to do?',
				attachments: userLoggedIn ? userRewards : [botOptions]
			});
	} catch (error) {
		console.log(error);
	}
}

slackBotInteractions.action({ type: 'select' }, (payload, respond) => {
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

slackBotInteractions.action({ type: 'button' }, (payload, respond) => {
	botHandler.respond(payload, respond)
});

slackBotInteractions.action({ type: 'plain_text_input' }, (payload, respond) => {
	payload.callback_id = "mainnet_account_input";
	botHandler.respond(payload, respond);
});

function selectNetwork(text, callbackId, respond) {
	networkSelect.callback_id = callbackId;

	respond({
		text: text,
		attachments: [networkSelect],
		replace_original: true
	})
}

module.exports.listenForEvents = listenForEvents;
module.exports.appMentionedHandler = appMentionedHandler;