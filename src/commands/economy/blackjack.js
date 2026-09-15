const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAccount, addCash } = require('../../utils/economyManager');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function newDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function handValue(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
        if (c.rank === 'A') { total += 11; aces++; }
        else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
        else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function fmtHand(hand) {
    return hand.map(c => `${c.rank}${c.suit}`).join(' ');
}

module.exports = {
    name: 'blackjack',
    aliases: ['bj'],
    description: 'Play blackjack against the bot (virtual currency only)',
    async execute(client, message, args) {
        const amount = parseInt(args[0], 10);
        if (!amount || amount <= 0) return message.reply('Usage: `.blackjack <amount>`');

        const acc = await getAccount(message.author.id, message.guild.id);
        if (acc.cash < amount) return message.reply("You don't have enough cash for that bet.");

        const deck = newDeck();
        const player = [deck.pop(), deck.pop()];
        const dealer = [deck.pop(), deck.pop()];

        const buildEmbed = (revealDealer, statusText) => new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🃏 Blackjack')
            .addFields(
                { name: `Your hand (${handValue(player)})`, value: fmtHand(player) },
                {
                    name: revealDealer ? `Dealer's hand (${handValue(dealer)})` : "Dealer's hand",
                    value: revealDealer ? fmtHand(dealer) : `${dealer[0].rank}${dealer[0].suit} 🂠`
                }
            )
            .setFooter({ text: statusText || `Bet: ${amount.toLocaleString()} coins` });

        const buildRow = (disabled = false) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Success).setDisabled(disabled),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Danger).setDisabled(disabled)
        );

        if (handValue(player) === 21) {
            const winnings = Math.floor(amount * 1.5);
            await addCash(message.author.id, message.guild.id, winnings);
            return message.reply({ embeds: [buildEmbed(true, `Blackjack! You won ${winnings.toLocaleString()} coins!`)] });
        }

        const sent = await message.reply({ embeds: [buildEmbed(false)], components: [buildRow()] });
        const collector = sent.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === message.author.id });

        const finish = async (result) => {
            let winnings = 0;
            let text;
            const pVal = handValue(player), dVal = handValue(dealer);

            if (result === 'bust') { winnings = -amount; text = `Bust! You lost ${amount.toLocaleString()} coins.`; }
            else if (result === 'dealer_bust' || (dVal < pVal && pVal <= 21)) { winnings = amount; text = `You won ${amount.toLocaleString()} coins!`; }
            else if (pVal === dVal) { winnings = 0; text = "Push — it's a tie, bet returned."; }
            else { winnings = -amount; text = `Dealer wins. You lost ${amount.toLocaleString()} coins.`; }

            if (winnings !== 0) await addCash(message.author.id, message.guild.id, winnings);
            await sent.edit({ embeds: [buildEmbed(true, text)], components: [buildRow(true)] });
        };

        collector.on('collect', async (i) => {
            if (i.customId === 'bj_hit') {
                player.push(deck.pop());
                if (handValue(player) > 21) {
                    await i.update({ embeds: [buildEmbed(true)], components: [buildRow(true)] });
                    return finish('bust');
                }
                await i.update({ embeds: [buildEmbed(false)], components: [buildRow()] });
            } else if (i.customId === 'bj_stand') {
                while (handValue(dealer) < 17) dealer.push(deck.pop());
                await i.update({ embeds: [buildEmbed(true)], components: [buildRow(true)] });
                collector.stop();
                return finish(handValue(dealer) > 21 ? 'dealer_bust' : 'compare');
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                // Timed out with no action — treat as a stand
                while (handValue(dealer) < 17) dealer.push(deck.pop());
                await finish(handValue(dealer) > 21 ? 'dealer_bust' : 'compare');
            }
        });
    }
};
