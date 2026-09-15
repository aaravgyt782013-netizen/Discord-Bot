const Discord = require("discord.js");
const Captcha = require("@haileybot/captcha-generator");

const reactionSchema = require("../../database/models/reactionRoles");
const banSchema = require("../../database/models/userBans");
const verify = require("../../database/models/verify");
const Commands = require("../../database/models/customCommand");
const CommandsSchema = require("../../database/models/customCommandAdvanced");
const ticketSchema = require("../../database/models/tickets");
const ticketMessageConfig = require("../../database/models/ticketMessage");

function setupAdmin(interaction, userId) {
  return interaction.guild && interaction.user.id === userId && interaction.member?.permissions?.has(Discord.PermissionsBitField.Flags.Administrator);
}

function ticketSetupRows(userId, draft = {}) {
  const category = new Discord.ChannelSelectMenuBuilder()
    .setCustomId(`lc_ts_cat:${userId}`)
    .setPlaceholder(draft.Category ? "Ticket category selected" : "1️⃣ Select ticket channel category")
    .addChannelTypes(Discord.ChannelType.GuildCategory);
  if (draft.Category) category.addDefaultChannels(draft.Category);

  const role = new Discord.RoleSelectMenuBuilder()
    .setCustomId(`lc_ts_role:${userId}`)
    .setPlaceholder(draft.Role ? "Support role selected" : "2️⃣ Select support role");
  if (draft.Role) role.addDefaultRoles(draft.Role);

  const logs = new Discord.ChannelSelectMenuBuilder()
    .setCustomId(`lc_ts_logs:${userId}`)
    .setPlaceholder(draft.Logs ? "Logs channel selected" : "3️⃣ Select logs channel")
    .addChannelTypes(Discord.ChannelType.GuildText);
  if (draft.Logs) logs.addDefaultChannels(draft.Logs);

  const transcript = new Discord.ChannelSelectMenuBuilder()
    .setCustomId(`lc_ts_transcript:${userId}`)
    .setPlaceholder(draft.Transcript ? "Transcript channel selected" : "4️⃣ Select transcript channel")
    .addChannelTypes(Discord.ChannelType.GuildText);
  if (draft.Transcript) transcript.addDefaultChannels(draft.Transcript);

  return [
    new Discord.ActionRowBuilder().addComponents(category),
    new Discord.ActionRowBuilder().addComponents(role),
    new Discord.ActionRowBuilder().addComponents(logs),
    new Discord.ActionRowBuilder().addComponents(transcript),
    new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId(`lc_ts_save:${userId}`).setLabel("Save Category").setEmoji("💾").setStyle(Discord.ButtonStyle.Success),
      new Discord.ButtonBuilder().setCustomId(`lc_ts_cancel:${userId}`).setLabel("Cancel").setStyle(Discord.ButtonStyle.Danger),
    ),
  ];
}

function panelChannelRow(userId, selected) {
  const channel = new Discord.ChannelSelectMenuBuilder()
    .setCustomId(`lc_ts_panelchannel:${userId}`)
    .setPlaceholder(selected ? "Panel channel selected" : "Select the public panel channel")
    .addChannelTypes(Discord.ChannelType.GuildText);
  if (selected) channel.addDefaultChannels(selected);
  return [
    new Discord.ActionRowBuilder().addComponents(channel),
    new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder().setCustomId(`lc_ts_publish:${userId}`).setLabel("Publish Ticket Panel").setEmoji("📨").setStyle(Discord.ButtonStyle.Success),
    ),
  ];
}

async function publishTicketPanel(client, interaction) {
  const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
  const config = await ticketMessageConfig.findOne({ Guild: interaction.guild.id });
  const categories = (data?.Categories || []).filter((c) => c.Enabled !== false);
  if (!categories.length) return interaction.reply({ content: "Add at least one ticket category first.", flags: Discord.MessageFlags.Ephemeral });
  if (categories.length > 25) return interaction.reply({ content: "Discord allows up to 25 options in one dropdown. Remove categories until there are 25 or fewer.", flags: Discord.MessageFlags.Ephemeral });
  if (!config?.panelChannel) return interaction.reply({ content: "Open Panel Editor and select a panel channel first.", flags: Discord.MessageFlags.Ephemeral });

  const channel = interaction.guild.channels.cache.get(config.panelChannel);
  if (!channel || channel.type !== Discord.ChannelType.GuildText) return interaction.reply({ content: "The saved panel channel no longer exists.", flags: Discord.MessageFlags.Ephemeral });

  const menu = new Discord.StringSelectMenuBuilder()
    .setCustomId("Bot_openticket")
    .setPlaceholder("🎫 Select a ticket category")
    .addOptions(categories.map((item) => ({
      label: String(item.Name).slice(0, 100),
      description: String(item.Description || "Open a support ticket").slice(0, 100),
      emoji: item.Emoji || "🎫",
      value: item._id?.toString() || item.Category,
    })));

  const sent = await channel.send({
    embeds: [new Discord.EmbedBuilder()
      .setTitle(config.panelTitle || "Need help? Open a ticket!")
      .setDescription(config.panelDescription || "Choose a ticket category below and our support team will help you.")
      .setColor(client.config.colors.normal)],
    components: [new Discord.ActionRowBuilder().addComponents(menu)],
  });

  config.panelMessageId = sent.id;
  await config.save();
  return interaction.reply({ content: `✅ Ticket panel published in ${channel}.`, flags: Discord.MessageFlags.Ephemeral });
}

module.exports = async (client, interaction) => {
  // Commands
  if (interaction.isCommand() || interaction.isUserContextMenuCommand()) {
    banSchema.findOne({ User: interaction.user.id }).then(async (data) => {
      if (data) {
        return client.errNormal({ error: "You have been banned by the developers of this bot", type: "ephemeral" }, interaction);
      }

      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) {
        const cmdd = await Commands.findOne({ Guild: interaction.guild.id, Name: interaction.commandName }).lean().cache("60 seconds").exec();
        if (cmdd) return interaction.channel.send({ content: cmdd.Responce });

        const cmdx = await CommandsSchema.findOne({ Guild: interaction.guild.id, Name: interaction.commandName }).lean().cache("60 seconds").exec();
        if (cmdx) {
          if (cmdx.Action == "Normal") return interaction.reply({ content: cmdx.Responce });
          if (cmdx.Action == "Embed") return client.simpleEmbed({ desc: `${cmdx.Responce}`, type: "reply" }, interaction);
          if (cmdx.Action == "DM") {
            await interaction.deferReply({ flags: Discord.MessageFlags.Ephemeral });
            interaction.editReply({ content: "I have sent you something in your DMs" });
            return interaction.user.send({ content: cmdx.Responce }).catch(() => client.errNormal({ error: "I can't DM you, maybe you have DM turned off!", type: "ephemeral" }, interaction));
          }
        }
      }

      if (interaction.options._subcommand !== null && interaction.options.getSubcommand() == "help") {
        const commands = interaction.client.commands
          .filter((x) => x.data.name == interaction.commandName)
          .map((x) => x.data.options.map((c) => "`" + c.name + "` - " + c.description).join("\n"));
        return client.embed({ title: "❓・Help panel", desc: `Get help with the commands in \`${interaction.commandName}\`\n\n${commands}`, type: "reply" }, interaction);
      }

      if (cmd) cmd.run(client, interaction, interaction.options._hoistedOptions).catch((err) => client.emit("errorCreate", err, interaction.commandName, interaction));
    });
  }

  // Ticket setup wizard
  if (interaction.isButton() && interaction.customId.startsWith("lc_ts_")) {
    const parts = interaction.customId.split(":");
    const action = parts[0];
    const owner = parts[1];
    if (!setupAdmin(interaction, owner)) return interaction.reply({ content: "Only the administrator who opened this setup can use these controls.", flags: Discord.MessageFlags.Ephemeral });

    if (action === "lc_ts_add") {
      const modal = new Discord.ModalBuilder().setCustomId(`lc_ts_modal:${owner}`).setTitle("Add Ticket Category");
      modal.addComponents(
        new Discord.ActionRowBuilder().addComponents(new Discord.TextInputBuilder().setCustomId("name").setLabel("Category name").setStyle(Discord.TextInputStyle.Short).setRequired(true).setMaxLength(80)),
        new Discord.ActionRowBuilder().addComponents(new Discord.TextInputBuilder().setCustomId("emoji").setLabel("Emoji").setStyle(Discord.TextInputStyle.Short).setRequired(false).setMaxLength(10).setValue("🎫")),
        new Discord.ActionRowBuilder().addComponents(new Discord.TextInputBuilder().setCustomId("description").setLabel("Category description").setStyle(Discord.TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
      );
      return interaction.showModal(modal);
    }

    if (action === "lc_ts_manage") {
      const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
      const categories = (data?.Categories || []).filter((c) => c.Enabled !== false).slice(0, 25);
      if (!categories.length) return interaction.reply({ content: "There are no categories to manage yet.", flags: Discord.MessageFlags.Ephemeral });
      const menu = new Discord.StringSelectMenuBuilder().setCustomId(`lc_ts_remove_select:${owner}`).setPlaceholder("Select a category to remove").addOptions(categories.map((c) => ({ label: c.Name.slice(0, 100), description: (c.Description || "Ticket category").slice(0, 100), emoji: c.Emoji || "🎫", value: c._id.toString() })));
      return interaction.reply({ content: "Select the ticket category you want to remove:", components: [new Discord.ActionRowBuilder().addComponents(menu)], flags: Discord.MessageFlags.Ephemeral });
    }

    if (action === "lc_ts_panel") {
      const config = await ticketMessageConfig.findOneAndUpdate({ Guild: interaction.guild.id }, { $setOnInsert: { Guild: interaction.guild.id } }, { upsert: true, new: true });
      const modal = new Discord.ModalBuilder().setCustomId(`lc_ts_panelmodal:${owner}`).setTitle("Ticket Panel Editor");
      modal.addComponents(
        new Discord.ActionRowBuilder().addComponents(new Discord.TextInputBuilder().setCustomId("title").setLabel("Panel title").setStyle(Discord.TextInputStyle.Short).setRequired(true).setMaxLength(255).setValue(config.panelTitle || "Need help? Open a ticket!")),
        new Discord.ActionRowBuilder().addComponents(new Discord.TextInputBuilder().setCustomId("description").setLabel("Panel description").setStyle(Discord.TextInputStyle.Paragraph).setRequired(true).setMaxLength(1024).setValue(config.panelDescription || "Choose a ticket category below and our support team will help you.")),
      );
      return interaction.showModal(modal);
    }

    if (action === "lc_ts_publish") return publishTicketPanel(client, interaction);
    if (action === "lc_ts_save") {
      const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
      const draft = data?.SetupDrafts?.find((d) => d.User === owner);
      if (!draft?.Name || !draft.Category || !draft.Role || !draft.Logs || !draft.Transcript) return interaction.reply({ content: "Complete all five category steps before saving: name, Discord category, support role, logs and transcript channel.", flags: Discord.MessageFlags.Ephemeral });
      if (!interaction.guild.channels.cache.get(draft.Category) || !interaction.guild.roles.cache.get(draft.Role) || !interaction.guild.channels.cache.get(draft.Logs) || !interaction.guild.channels.cache.get(draft.Transcript)) return interaction.reply({ content: "One of the selected Discord objects no longer exists. Please select them again.", flags: Discord.MessageFlags.Ephemeral });
      data.Categories.push({ Name: draft.Name, Category: draft.Category, Role: draft.Role, Logs: draft.Logs, Transcript: draft.Transcript, Description: draft.Description || `Open a ${draft.Name} ticket`, Emoji: draft.Emoji || "🎫", Enabled: true });
      data.SetupDrafts = data.SetupDrafts.filter((d) => d.User !== owner);
      if (!data.Category) data.Category = draft.Category;
      if (!data.Role) data.Role = draft.Role;
      if (!data.Logs) data.Logs = draft.Logs;
      await data.save();
      return interaction.reply({ content: `✅ **${draft.Name}** was added. You can add another category or open Panel Editor.`, flags: Discord.MessageFlags.Ephemeral });
    }
    if (action === "lc_ts_cancel") return interaction.reply({ content: "Category setup cancelled.", flags: Discord.MessageFlags.Ephemeral });
    if (action === "lc_ts_remove_confirm") {
      const id = parts[2];
      const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
      if (!data) return interaction.reply({ content: "Ticket setup not found.", flags: Discord.MessageFlags.Ephemeral });
      data.Categories = data.Categories.filter((c) => c._id?.toString() !== id);
      await data.save();
      return interaction.reply({ content: "🗑️ Ticket category removed.", flags: Discord.MessageFlags.Ephemeral });
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("lc_ts_")) {
    const parts = interaction.customId.split(":");
    const action = parts[0];
    const owner = parts[1];
    if (!setupAdmin(interaction, owner)) return interaction.reply({ content: "Only the administrator who opened this setup can use it.", flags: Discord.MessageFlags.Ephemeral });

    if (action === "lc_ts_modal") {
      const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
      if (!data) return interaction.reply({ content: "Open `.setup tickets` again to start setup.", flags: Discord.MessageFlags.Ephemeral });
      data.SetupDrafts = data.SetupDrafts.filter((d) => d.User !== owner);
      data.SetupDrafts.push({ User: owner, Name: interaction.fields.getTextInputValue("name").trim(), Emoji: interaction.fields.getTextInputValue("emoji").trim() || "🎫", Description: interaction.fields.getTextInputValue("description").trim() });
      await data.save();
      const draft = data.SetupDrafts.find((d) => d.User === owner);
      return interaction.reply({ content: `**${draft.Name}** started. Now select its Discord category, support role, logs channel and transcript channel.`, components: ticketSetupRows(owner, draft), flags: Discord.MessageFlags.Ephemeral });
    }

    if (action === "lc_ts_panelmodal") {
      const config = await ticketMessageConfig.findOneAndUpdate({ Guild: interaction.guild.id }, { $set: { panelTitle: interaction.fields.getTextInputValue("title").trim(), panelDescription: interaction.fields.getTextInputValue("description").trim() } }, { upsert: true, new: true });
      return interaction.reply({ content: "Panel appearance saved. Now select where the public ticket panel should be posted.", components: panelChannelRow(owner, config.panelChannel), flags: Discord.MessageFlags.Ephemeral });
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId.startsWith("lc_ts_")) {
    const parts = interaction.customId.split(":");
    const action = parts[0];
    const owner = parts[1];
    if (!setupAdmin(interaction, owner)) return interaction.reply({ content: "Only the administrator who opened this setup can use it.", flags: Discord.MessageFlags.Ephemeral });

    if (["lc_ts_cat", "lc_ts_logs", "lc_ts_transcript"].includes(action)) {
      const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
      const draft = data?.SetupDrafts?.find((d) => d.User === owner);
      if (!draft) return interaction.reply({ content: "Start Add Category again.", flags: Discord.MessageFlags.Ephemeral });
      if (action === "lc_ts_cat") draft.Category = interaction.values[0];
      if (action === "lc_ts_logs") draft.Logs = interaction.values[0];
      if (action === "lc_ts_transcript") draft.Transcript = interaction.values[0];
      await data.save();
      return interaction.update({ content: `Configuring **${draft.Name}**. Complete all selections, then press Save Category.`, components: ticketSetupRows(owner, draft) });
    }

    if (action === "lc_ts_panelchannel") {
      const config = await ticketMessageConfig.findOneAndUpdate({ Guild: interaction.guild.id }, { $set: { panelChannel: interaction.values[0] } }, { upsert: true, new: true });
      return interaction.update({ content: "Panel channel saved. Press **Publish Ticket Panel** when you are ready.", components: panelChannelRow(owner, config.panelChannel) });
    }
  }

  if (interaction.isRoleSelectMenu() && interaction.customId.startsWith("lc_ts_role:")) {
    const owner = interaction.customId.split(":")[1];
    if (!setupAdmin(interaction, owner)) return interaction.reply({ content: "Only the administrator who opened this setup can use it.", flags: Discord.MessageFlags.Ephemeral });
    const data = await ticketSchema.findOne({ Guild: interaction.guild.id });
    const draft = data?.SetupDrafts?.find((d) => d.User === owner);
    if (!draft) return interaction.reply({ content: "Start Add Category again.", flags: Discord.MessageFlags.Ephemeral });
    draft.Role = interaction.values[0];
    await data.save();
    return interaction.update({ content: `Configuring **${draft.Name}**. Complete all selections, then press Save Category.`, components: ticketSetupRows(owner, draft) });
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("lc_ts_remove_select:")) {
    const owner = interaction.customId.split(":")[1];
    if (!setupAdmin(interaction, owner)) return interaction.reply({ content: "Only the administrator who opened this setup can use it.", flags: Discord.MessageFlags.Ephemeral });
    const id = interaction.values[0];
    return interaction.update({ content: "Confirm removal of this ticket category?", components: [new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setCustomId(`lc_ts_remove_confirm:${owner}:${id}`).setLabel("Remove Category").setEmoji("🗑️").setStyle(Discord.ButtonStyle.Danger))] });
  }

  // Verify system
  if (interaction.isButton() && interaction.customId == "Bot_verify") {
    const data = await verify.findOne({ Guild: interaction.guild.id, Channel: interaction.channel.id }).lean();
    if (data) {
      let captcha = new Captcha();
      try {
        var image = new Discord.AttachmentBuilder(captcha.JPEGStream, { name: "captcha.jpeg" });
        interaction.reply({ files: [image], withResponse: true }).then(function (msg) {
          const filter = (s) => s.author.id == interaction.user.id;
          interaction.channel.awaitMessages({ filter, max: 1 }).then((response) => {
            if (response.first().content === captcha.value) {
              response.first().delete(); msg.resource.message.delete();
              client.succNormal({ text: "You have been successfully verified!" }, interaction.user).catch(() => {});
              const verifyUser = interaction.guild.members.cache.get(interaction.user.id);
              verifyUser.roles.add(data.Role);
            } else {
              response.first().delete(); msg.resource.message.delete();
              client.errNormal({ error: "You have answered the captcha incorrectly!", type: "editreply" }, interaction).then((msgError) => setTimeout(() => msgError.delete(), 2000));
            }
          });
        });
      } catch (error) { console.log(error); }
    } else {
      client.errNormal({ error: "Verify is disabled in this server! Or you are using the wrong channel!", type: "ephemeral" }, interaction);
    }
  }

  // Reaction roles
  if (interaction.isButton()) {
    const buttonID = interaction.customId.split("-");
    if (buttonID[0] == "reaction_button") {
      reactionSchema.findOne({ Message: interaction.message.id }).lean().then(async (data) => {
        if (!data) return;
        const [roleid] = data.Roles[buttonID[1]];
        if (interaction.member.roles.cache.get(roleid)) interaction.guild.members.cache.get(interaction.user.id).roles.remove(roleid).catch(() => {});
        else interaction.guild.members.cache.get(interaction.user.id).roles.add(roleid).catch(() => {});
        interaction.reply({ content: `<@&${roleid}> was ${interaction.member.roles.cache.get(roleid) ? "removed" : "added"}!`, flags: Discord.MessageFlags.Ephemeral });
      });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId == "reaction_select") {
    reactionSchema.findOne({ Message: interaction.message.id }).lean().then(async (data) => {
      if (!data) return;
      let roles = "";
      for (let i = 0; i < interaction.values.length; i++) {
        const [roleid] = data.Roles[interaction.values[i]];
        roles += `<@&${roleid}> `;
        if (interaction.member.roles.cache.get(roleid)) interaction.guild.members.cache.get(interaction.user.id).roles.remove(roleid).catch(() => {});
        else interaction.guild.members.cache.get(interaction.user.id).roles.add(roleid).catch(() => {});
      }
      interaction.reply({ content: `I have updated the following roles for you: ${roles}`, flags: Discord.MessageFlags.Ephemeral });
    });
  }

  // Tickets
  if (interaction.customId == "Bot_openticket") return require(`${process.cwd()}/src/commands/tickets/create.js`)(client, interaction);
  if (interaction.customId == "Bot_closeticket") return require(`${process.cwd()}/src/commands/tickets/close.js`)(client, interaction);
  if (interaction.customId == "Bot_claimTicket") return require(`${process.cwd()}/src/commands/tickets/claim.js`)(client, interaction);
  if (interaction.customId == "Bot_transcriptTicket") return require(`${process.cwd()}/src/commands/tickets/transcript.js`)(client, interaction);
  if (interaction.customId == "Bot_openTicket") return require(`${process.cwd()}/src/commands/tickets/open.js`)(client, interaction);
  if (interaction.customId == "Bot_deleteTicket") return require(`${process.cwd()}/src/commands/tickets/delete.js`)(client, interaction);
  if (interaction.customId == "Bot_noticeTicket") return require(`${process.cwd()}/src/commands/tickets/notice.js`)(client, interaction);
};
