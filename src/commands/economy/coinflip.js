const { EmbedBuilder } = require('discord.js');
const { getAccount, addCash } = require('../../utils/economyManager');

module.exports = {
    name: 'coinflip',
    aliases: ['cf'],
    description: 'Bet coins on a coinflip (virtual currency only)',
    async execute(client, message, args) {
        const amount = parseInt(args[0], 10);
        const choice = (args[1] || '').toLowerCase();

        if (!amount || amount <= 0) return message.reply('Usage: `.coinflip <amount> <heads/tails>`');
        if (!['heads', 'tails'].includes(choice)) return message.reply('Pick `heads` or `tails`.');

        const acc = await getAccount(message.author.id, message.guild.id);
        if (acc.cash < amount) return message.reply("You don't have enough cash for that bet.");

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === choice;

        await addCash(message.author.id, message.guild.id, won ? amount : -amount);

        const embed = new EmbedBuilder()
            .setColor(won ? '#57F287' : '#ED4245')
            .setDescription(
                `🪙 The coin landed on **${result}**!\n` +
                (won
                    ? `You won **${amount.toLocaleString()}** coins!`
                    : `You lost **${amount.toLocaleString()}** coins.`)
            );

        message.reply({ embeds: [embed] });
    }
};
