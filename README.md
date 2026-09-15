# LightCore

LightCore is a configurable all-in-one Discord bot built with Discord.js v14. It combines moderation, automation, tickets, leveling, economy, music, games, giveaways, reaction roles, server utilities and more in one project.

## ✨ Highlights

- Slash commands with Discord's native command picker
- Prefix commands with configurable server prefix (default: `.`)
- Prefix support for nested commands such as `.ticket help` and `.setup tickets`
- Interactive ticket setup wizard
- Multiple ticket categories with independent settings
- Ticket category, support role, logs and transcript configuration
- Ticket panel editor with interactive dropdown publishing
- Moderation and automod tools
- Leveling, message rewards and server statistics
- Economy, games, fun and utility systems
- Reaction roles, suggestions, giveaways and custom commands
- MongoDB persistence
- Graceful error handling and configuration validation

## 🚀 Requirements

- Node.js 18+ recommended
- MongoDB connection string
- Discord bot token
- Discord application/client ID
- Additional API keys only for features that require them (for example music/search/AI integrations)

## ⚙️ Configuration

1. Create a Discord application and bot in the Discord Developer Portal.
2. Copy the required environment variables from `.env.example` into your deployment environment.
3. Set your bot token and client/application ID.
4. Set the MongoDB connection string.
5. Install dependencies with `npm install`.
6. Start with `npm start`.

Never commit your bot token, database credentials, API keys or other secrets to GitHub.

## 🎫 Ticket setup

After inviting LightCore with the permissions required by your server, an administrator can run:

```text
/setup tickets
```

or:

```text
.setup tickets
```

The interactive wizard lets you:

1. Add multiple ticket categories.
2. Give every category its own name, emoji and description.
3. Select its Discord category.
4. Select its support role.
5. Select its logs channel.
6. Select its transcript channel.
7. Edit/manage configured categories.
8. Customize the public ticket panel.
9. Publish the panel to a selected channel.

Discord limits a normal string-select menu to 25 options, so a single LightCore ticket panel supports up to 25 categories. citehttps://discord.com/developers/docs/components/reference#string-select-select-menu-structure

## ⌨️ Prefix commands

The default prefix is `.`. The prefix can be configured per server through the bot's settings system. Slash commands remain available alongside prefix commands.

Examples:

```text
.help
.ticket help
.tickets create
.setup tickets
```

## 🛡️ Permissions

Only trusted administrators should be given setup permissions. Discord also provides server-side command permission controls under Server Settings → Integrations, allowing individual app commands to be restricted to selected roles, members or channels.

## 🔐 Security

LightCore should be deployed with the minimum Discord permissions required for the features you enable. Keep credentials private and review the bot's data access and enabled integrations before public distribution.

## 🧪 Testing

Run the built-in source syntax check before publishing:

```bash
npm test
```

A successful test means the JavaScript source parses successfully. Production testing should additionally cover Discord permissions, MongoDB connectivity, music/API integrations, ticket creation/closure, moderation actions and restart recovery in a private test server.

## 💬 Support

Support server: https://discord.gg/Ehmqr5drSz

## 📄 License

MIT

LightCore is an independent project. This repository is not the official source of any other Discord bot or project.
