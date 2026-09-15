const Discord = require("discord.js");

/**
 * @type {import("../../typings.d").Command}
 */
module.exports = async (client, interaction, args) => {
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return client.errNormal(
      {
        error: `You're not in a voice channel!`,
        type: "editreply",
      },
      interaction,
    );
  }

  if (!voiceChannel.joinable) {
    return client.errNormal(
      {
        error: `I can't join that voice channel. Please check my Connect permission.`,
        type: "editreply",
      },
      interaction,
    );
  }

  const me = interaction.guild?.members?.me;
  if (me && !voiceChannel.permissionsFor(me)?.has(Discord.PermissionFlagsBits.Connect)) {
    return client.errNormal(
      {
        error: `I don't have permission to connect to that voice channel.`,
        type: "editreply",
      },
      interaction,
    );
  }

  const query = interaction.options?.getString?.("song")?.trim();
  if (!query) {
    return client.errNormal(
      {
        error: `Please provide a song name or URL.`,
        type: "editreply",
      },
      interaction,
    );
  }

  let player = client.player.players.get(interaction.guild.id);

  if (player && voiceChannel.id !== player.voiceId) {
    return client.errNormal(
      {
        error: `You are not in the same voice channel as the music player.`,
        type: "editreply",
      },
      interaction,
    );
  }

  const destroyIfEmpty = () => {
    try {
      if (player && !player.queue.current && typeof player.destroy === "function") {
        player.destroy();
      }
    } catch (_) {
      // Cleanup must never hide the original music error.
    }
  };

  try {
    if (!player) {
      player = await client.player.createPlayer({
        guildId: interaction.guild.id,
        voiceId: voiceChannel.id,
        textId: interaction.channel.id,
        deaf: true,
      });
    }

    player = client.player.players.get(interaction.guild.id) || player;

    if (!player) {
      throw new Error("The music player could not be created.");
    }

    await client.simpleEmbed(
      {
        desc: `🔎┆Searching for **${query.slice(0, 150)}**...`,
        type: "editreply",
      },
      interaction,
    );

    const res = await player.search(query, { requester: interaction.user });

    if (!res?.tracks?.length) {
      destroyIfEmpty();
      return client.errNormal(
        {
          error: `No music results were found for that search.`,
          type: "editreply",
        },
        interaction,
      );
    }

    const startPlayback = async () => {
      if (!player.playing && !player.paused) {
        await player.play();
        return true;
      }
      return false;
    };

    const sendQueued = async (track) => {
      const duration = Number(track.duration ?? track.length ?? 0);
      const endsAt = duration > 0
        ? `<t:${Math.floor(Date.now() / 1000 + duration / 1000)}:f>`
        : `Unknown`;

      return client.embed(
        {
          title: `${client.emotes.normal.music}・${String(track.title || "Unknown track").slice(0, 256)}`,
          url: track.uri,
          desc: `The song has been added to the queue!`,
          thumbnail: track.thumbnail,
          fields: [
            {
              name: `👤┆Requested By`,
              value: `${track.requester || interaction.user}`,
              inline: true,
            },
            {
              name: `${client.emotes.normal.clock}┆Ends at`,
              value: endsAt,
              inline: true,
            },
            {
              name: `🎬┆Author`,
              value: `${String(track.author || "Unknown").slice(0, 1024)}`,
              inline: true,
            },
          ],
          type: "editreply",
        },
        interaction,
      );
    };

    switch (res.type) {
      case "TRACK": {
        const track = res.tracks[0];
        await player.queue.add(track);

        const started = await startPlayback();
        if (!started) await sendQueued(track);
        break;
      }

      case "PLAYLIST": {
        await player.queue.add(res.tracks);
        const started = await startPlayback();

        if (started) {
          await client.simpleEmbed(
            {
              desc: `▶️┆Started playlist **${String(res.playlist?.name || "Playlist").slice(0, 150)}** with **${res.tracks.length}** tracks.`,
              type: "editreply",
            },
            interaction,
          );
        } else {
          await client.simpleEmbed(
            {
              desc: `📋┆Added **${res.tracks.length}** tracks to the queue.`,
              type: "editreply",
            },
            interaction,
          );
        }
        break;
      }

      case "SEARCH": {
        const max = Math.min(5, res.tracks.length);
        const buttons = [];

        for (let index = 0; index < max; index++) {
          buttons.push(
            new Discord.ButtonBuilder()
              .setEmoji(["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][index])
              .setCustomId(`lc_music_pick:${interaction.user.id}:${index}`)
              .setStyle(Discord.ButtonStyle.Secondary),
          );
        }

        const row = new Discord.ActionRowBuilder().addComponents(buttons);
        const cancelRow = new Discord.ActionRowBuilder().addComponents(
          new Discord.ButtonBuilder()
            .setEmoji("🛑")
            .setLabel("Cancel")
            .setCustomId(`lc_music_cancel:${interaction.user.id}`)
            .setStyle(Discord.ButtonStyle.Danger),
        );

        const results = res.tracks
          .slice(0, max)
          .map((track, index) => {
            const title = String(track.title || "Unknown track");
            return `**[#${index + 1}]**┆${title.length > 45 ? `${title.slice(0, 45)}...` : title}`;
          })
          .join("\n");

        await client.embed(
          {
            title: `🔍・Search Results`,
            desc: results,
            fields: [
              {
                name: `❓┆Choose a track`,
                value: `Select a result below. This menu expires in 30 seconds.`,
                inline: true,
              },
            ],
            components: [row, cancelRow],
            type: "editreply",
          },
          interaction,
        );

        let selection;
        try {
          selection = await interaction.channel.awaitMessageComponent({
            filter: (component) => component.user.id === interaction.user.id,
            max: 1,
            time: 30_000,
            componentType: Discord.ComponentType.Button,
          });
        } catch (_) {
          row.components.forEach((button) => button.setDisabled(true));
          cancelRow.components.forEach((button) => button.setDisabled(true));
          return client.errNormal(
            {
              error: `Search selection expired. Please run the music command again.`,
              type: "editreply",
              components: [row, cancelRow],
            },
            interaction,
          );
        }

        const customId = selection.customId;
        await selection.deferUpdate().catch(() => {});

        if (customId.startsWith(`lc_music_cancel:${interaction.user.id}`)) {
          destroyIfEmpty();
          return client.simpleEmbed(
            {
              desc: `🛑┆Music search cancelled.`,
              type: "editreply",
              components: [],
            },
            interaction,
          );
        }

        const prefix = `lc_music_pick:${interaction.user.id}:`;
        if (!customId.startsWith(prefix)) {
          return client.errNormal(
            {
              error: `That selection is no longer valid.`,
              type: "editreply",
              components: [],
            },
            interaction,
          );
        }

        const index = Number(customId.slice(prefix.length));
        if (!Number.isInteger(index) || index < 0 || index >= max) {
          return client.errNormal(
            {
              error: `That music selection is invalid.`,
              type: "editreply",
              components: [],
            },
            interaction,
          );
        }

        const track = res.tracks[index];
        await player.queue.add(track);

        const started = await startPlayback();
        if (started) {
          await client.simpleEmbed(
            {
              desc: `▶️┆Now playing **${String(track.title || "Unknown track").slice(0, 150)}**.`,
              type: "editreply",
              components: [],
            },
            interaction,
          );
        } else {
          await sendQueued(track);
        }
        break;
      }

      default:
        throw new Error(`Unsupported music search result type: ${res.type}`);
    }

    if (voiceChannel.type === Discord.ChannelType.GuildStageVoice) {
      setTimeout(() => {
        const member = interaction.guild.members.me;
        if (member?.voice?.channelId === voiceChannel.id && member.voice.suppress) {
          member.voice.setSuppressed(false).catch(() => {});
        }
      }, 750);
    }
  } catch (error) {
    console.error(`[Music] ${interaction.guild?.id || "unknown-guild"}:`, error);
    destroyIfEmpty();

    const message = String(error?.message || error || "Unknown music error");
    const userMessage = /lavalink|node|connection|socket|voice|load failed|search/i.test(message)
      ? `The music service is temporarily unavailable. Please try again in a moment.`
      : `I couldn't play that music right now. Please try again.`;

    return client.errNormal(
      {
        error: userMessage,
        type: "editreply",
      },
      interaction,
    );
  }
};
