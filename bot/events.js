const { createEventAdapter } = require('@slack/events-api');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const { WebClient } = require('@slack/web-api');
const token = process.env.SLACK_BOT_TOKEN;
const web = new WebClient(token);
const botoption = require('../elements/botoptions.json');
const userrewards = require('../elements/userrewards.json');

function listenForEvents(app) {
  app.use('/events', slackEvents.requestListener());

  slackEvents.on('app_mention', (event) => {
    console.log(`Received an app_mention event from user ${event.user} in channel ${event.channel}`);
    appMentionedHandler(event)
  });

	slackEvents.on("reaction_added", async (event) => {
		if(event.reaction == "near_icon") {
			try {
				await web.chat.postEphemeral({
					channel: event.item.channel,
					user: event.user,
					attachments: userrewards
				});
				console.log('Message posted!')
			} catch (error) {
				console.log(error)
			}
		}
	});

  slackEvents.on('error', (error) => {
    console.log(`error: ${error}`)
  })
}

async function appMentionedHandler(event) {
  try {
    await web.chat.postEphemeral({
      channel: event.channel,
			user: event.user,
      text: '',
      attachments: [botoption]
    });
    console.log('Message posted!')
  } catch (error) {
    console.log(error)
  }
}

module.exports.listenForEvents = listenForEvents;
module.exports.appMentionedHandler = appMentionedHandler;
