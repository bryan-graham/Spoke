[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md)

## Spoke History

Spoke is an open source text-distribution tool for organizations to mobilize supporters and members into action. Spoke allows you to upload phone numbers, customize scripts and assign volunteers to communicate with supporters while allowing organizations to manage the process.

Spoke was created by Saikat Chakrabarti and Sheena Pakanati.

On November 19th, 2023, the repo Spoke was transferred from MoveOn to [State Voices](https://github.com/StateVoicesNational/Dispatch) and kind of renamed to "Dispatch". There haven't been any updates to the repo since about October 2024.

This fork's current version is **15.0.0** (based on Spoke 14.1.2): see the [Release Notes](docs/RELEASE_NOTES.md).

## Notes on this Fork

This is a standalone fork of [ProgressiveCoders/Spoke](https://github.com/ProgressiveCoders/Spoke).
Changes are made here and aren't sent back to the projects it came from.

### A new look

Spoke's interface has been redesigned to match [Shore](https://shore.vote), so the two feel
like one product:

- **Layout:** a sidebar for navigation, with each page on a raised panel beside it. On phones
  the sidebar slides in from a menu button. The texting screens stay full screen so texters
  can focus.
- **Style:** Shore's colours, the Inter and DM Sans fonts, rounded cards and tables, and
  Tabler icons.
- **Dark mode:** each person can choose light, dark, or match their device from the account
  menu at the bottom of the sidebar. When Spoke is connected to Shore, it follows the
  person's Shore setting instead.
- **Navigation:** texters see their assignments; admins also see Campaigns, People, Message
  Review and Spoke's other admin pages, depending on their role.

None of this needs setting up. Organizations that chose custom colours in Settings keep them
for buttons and highlights.

### Shore integration

Spoke can work with Shore, a campaign organizing app, or entirely on its own. When connected:

- **Contact lists:** campaign admins can load a Shore segment as a campaign's contacts. Shore
  sends only people it's allowed to text.
- **Opt-outs:** opt-outs Shore receives by email, phone or forms reach Spoke within seconds,
  and opt-outs recorded in Spoke reach Shore.
- **Conversations:** Shore can read messages, survey answers and tags from Spoke, so they
  appear on each person's record in Shore.
- **One menu:** Spoke's sidebar shows Shore's menu, with Spoke's pages under Texting, so
  people can move between the two apps.
- **Sign-in:** people can sign in to Spoke through Shore.

Without Shore, Spoke works as before, with its own pages in the sidebar.

To connect, see [How to integrate with Shore](docs/HOWTO-integrate-with-shore.md). More
detail:

- [Spoke's Shore interface](docs/shore-ui.md): what changed in the interface and how to set
  up Shore's menu, colour scheme and logos.
- [Shore integration contract](docs/shore-contract.md): the exact interface between the two
  apps, for developers.
- [Building Shore's side](docs/shore-implementation-guide.md): for the team working on Shore.

## Setting up Spoke

The easiest way to get started is with Heroku. You can also learn about Spoke through the [texter](https://youtu.be/EqE1UDvKGco) and [admin](https://youtu.be/PTMykMX8gII) video demos or in the explanation on [how to decide if Spoke is right for you.](docs/EXPLANATION_DECIDING_ON_SPOKE.md)

For developers, please see our recommendations for [deploying locally for development](docs/HOWTO_DEVELOPMENT_LOCAL_SETUP.md).

Want to know more? This fork's documentation is in the [docs folder](docs/). The original
project's [documentation microsite](https://statevoicesnational.github.io/Spoke/) covers the
rest of Spoke, but not this fork's changes.

### Quick Start with Heroku

This button deploys **this fork** ([bryan-graham/Spoke](https://github.com/bryan-graham/Spoke),
version 15.0.0, with the new interface and Shore support), not the original Spoke project.
It's suitable for testing and, potentially, for small campaigns. It uses Heroku's smallest
paid plans (a few dollars a month) and won't support production (large-scale) use.

<a href="https://heroku.com/deploy?template=https://github.com/bryan-graham/Spoke/tree/v15.0.0">
  <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy this fork to Heroku">
</a>

Follow-up instructions are [here](docs/HOWTO_HEROKU_DEPLOY.md). To connect the deployment to
Shore, see [How to integrate with Shore](docs/HOWTO-integrate-with-shore.md).

**NOTE:** For production use, upgrade the app's dyno and Postgres plans in Heroku's dashboard
(Resources) before you start any live campaigns: changing the database plan later means
migrating data from earlier campaigns. Expect roughly $75 a month for most organizations.

### Other Options for Production Use

You can also [deploy on AWS Lambda.](docs/HOWTO_DEPLOYING_AWS_LAMBDA.md) which is a lot cheaper than Heroku at scale, but requires considerably more technical knowledge to deploy and maintain. We recommend this option for large scale campaigns with tech resources.

Additional guidance:

- [Choosing a set-up for production](docs/EXPLANATION_CHOOSE_A_SETUP.md)
- [How to hire someone to install Spoke](docs/HOWTO_HIRE_SOMEONE_TO_INSTALL_SPOKE.md)
- [Option for minimalist deployment](docs/HOWTO_MINIMALIST_DEPLOY.md)

# License

Spoke is licensed under the [GPL3 license with a special author attribution requirement](LICENSE).
