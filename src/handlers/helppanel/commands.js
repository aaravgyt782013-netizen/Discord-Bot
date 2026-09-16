const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

const ECONOMY_DIR = path.join(process.cwd(), 'src', 'commands', 'economy');
const ADMIN_COMMANDS = new Set(['addmoney', 'removemoney', 'clear', 'additem', 'deleteitem']);
const EXCLUDED_COMMANDS = new Set(['slots', 'coinflip', 'blackjack']);

function economyEntries(client) {
    const slash = client.commands.get('economy');
    const slashData = typeof slash?.data?.toJSON === 'function' ? slash.data.toJSON() : slash?.data;
    const descriptions = new Map((slashData?.options || [])
        .filter((o) => o.type === 1)
        .map((o) => [o.name, o.description]));

    if (!fs.existsSync(ECONOMY_DIR)) return { publicEntries: [], adminEntries: [] };

    const entries = [];
    for (const file of fs.readdirSync(ECONOMY_DIR).filter((f) => f.endsWith('.js')).sort()) {
        const filename = file.replace(/\.js$/, '').toLowerCase();
        if (EXCLUDED_COMMANDS.has(filename)) continue;

        let exported;
        try { exported = require(path.join(ECONOMY_DIR, file)); } catch { continue; }
        const name = exported?.name || filename;
        const aliases = Array.isArray(exported?.aliases) ? exported.aliases : [];
        const description = exported?.description || descriptions.get(filename) || 'No description declared in this command file.';
        entries.push({ name, aliases, description, admin: ADMIN_COMMANDS.has(filename) });
    }

    return {
        publicEntries: entries.filter((e) => !e.admin),
        adminEntries: entries.filter((e) => e.admin),
    };
}

function buildFields(client) {
    const base = [
        ['📺┆Activities', '`/activities`'], ['🚫┆AFK', '`/afk help`'], ['📣┆Announcement', '`/announcement help`'],
        ['👮‍♂️┆Auto mod', '`/automod help`'], ['⚙️┆Auto setup', '`/autosetup help`'], ['🎂┆Birthday', '`/birthdays help`'],
        ['🤖┆Bot', '`/bot help`'], ['🎰┆Casino', '`/casino help`'], ['⚙┆Configuration', '`/config help`'],
        ['💻┆Custom commands', '`/custom-commands help`'], ['💳┆Dcredits', '`/dcredits help`'], ['👪┆Family', '`/family help`'],
        ['😂┆Fun', '`/fun help`'], ['🎮┆Games', '`/games help`'], ['🥳┆Giveaway', '`/giveaway help`'],
        ['⚙️┆Guild settings', '`/guild help`'], ['🖼┆Images', '`/images help`'], ['📨┆Invites', '`/invites help`'],
        ['🆙┆Leveling', '`/levels help`'], ['💬┆Messages', '`/messages help`'], ['👔┆Moderation', '`/moderation help`'],
        ['🎶┆Music', '`/music help`'], ['📓┆Notepad', '`/notepad help`'], ['👤┆Profile', '`/profile help`'],
        ['📻┆Radio', '`/radio help`'], ['😛┆Reaction roles', '`/reactionroles help`'], ['🔍┆Search', '`/search help`'],
        ['📊┆Server stats', '`/serverstats help`'], ['⚙️┆Setup', '`/setup help`'], ['🎛┆Soundboard', '`/soundboard help`'],
        ['🗨️┆Sticky messages', '`/stickymessages help`'], ['💡┆Suggestions', '`/sugestions help`'], ['🤝┆Thanks', '`/thanks help`'],
        ['🎫┆Tickets', '`/tickets help`'], ['⚒️┆Tools', '`/tools help`'], ['🔊┆Voice', '`/voice help`'],
    ].map(([name, value]) => ({ name, value, inline: true }));

    const { publicEntries, adminEntries } = economyEntries(client);
    const economyFields = publicEntries.map((e) => ({
        name: `💰┆${e.name}`,
        value: `${e.description}${e.aliases.length ? `\nAliases: ${e.aliases.map((a) => `\`${a}\``).join(', ')}` : ''}`,
        inline: true,
    }));
    const adminFields = adminEntries.map((e) => ({
        name: `🛠️┆${e.name}`,
        value: e.description,
        inline: true,
    }));

    return [
        ...base,
        { name: '💰┆Economy', value: 'Player economy commands are listed below.', inline: false },
        ...economyFields,
        { name: '🛡️┆Admin/Economy', value: 'Restricted economy-management commands.', inline: false },
        ...adminFields,
    ];
}

module.exports = async (client) => {
    const fields = buildFields(client);

    client.on(Discord.Events.InteractionCreate, async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'Bot-helppanel') return;
        if (interaction.values != 'commands-Bothelp') return;

        await interaction.deferUpdate();
        let page = 1;
        const row = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder().setCustomId('helpPrev').setEmoji('⬅️').setStyle(Discord.ButtonStyle.Secondary),
            new Discord.ButtonBuilder().setCustomId('helpNext').setEmoji('➡️').setStyle(Discord.ButtonStyle.Secondary),
            new Discord.ButtonBuilder().setLabel('Invite').setURL(client.config.discord.botInvite).setStyle(Discord.ButtonStyle.Link),
            new Discord.ButtonBuilder().setLabel('Support server').setURL(client.config.discord.serverInvite).setStyle(Discord.ButtonStyle.Link),
        );
        const row2 = new Discord.ActionRowBuilder().addComponents(
            new Discord.StringSelectMenuBuilder().setCustomId('Bot-helppanel').setPlaceholder('❌┆Nothing selected').addOptions([
                { label: 'Commands', description: 'Show the commands of Bot!', emoji: '💻', value: 'commands-Bothelp' },
                { label: 'Invite', description: 'Invite Bot to your server', emoji: '📨', value: 'invite-Bothelp' },
                { label: 'Support server', description: 'Join the suppport server', emoji: '❓', value: 'support-Bothelp' },
                { label: 'Changelogs', description: 'Show the bot changelogs', emoji: '📃', value: 'changelogs-Bothelp' },
            ]),
        );

        const render = (target, type = 'edit') => client.embed({
            title: '❓・Help panel',
            desc: `View all command categories in the bot here!\n\n[Website](https://corwindev.nl) | [Invite](${client.config.discord.botInvite}) | [Vote](https://top.gg/bot/798144456528363550/vote)`,
            fields: fields.slice(page === 1 ? 0 : 25, page === 1 ? 25 : 50),
            components: [row2, row],
            type,
        }, target);

        await render(interaction.message, 'edit');
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 100000 });
        collector.on('collect', async (i) => {
            if (i.customId === 'helpNext' && page === 1) { page = 2; await render(i, 'update'); }
            else if (i.customId === 'helpPrev' && page === 2) { page = 1; await render(i, 'update'); }
        });
    });
};