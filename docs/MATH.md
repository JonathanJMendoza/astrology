# Astral Fortune Return Model

The game targets **98.00% theoretical RTP**, or a **2.00% house edge**, for every supported credit bet and denomination. This includes all line wins, constellation matches, free spins, and recursively triggered bonuses. It is a mathematical expectation over long-run play, not a session guarantee or gambling certification.

## Distribution and Payouts

Each of the 15 cells is drawn independently using an unbiased `random-js` integer distribution driven by browser cryptographic randomness. There are 1,200,000,000,000 tickets per draw:

| Symbol | Tickets | 3 / 4 / 5 matches, per line bet |
| --- | ---: | --- |
| Each of 12 zodiac signs | 92,227,671,483 | 20 / 100 / 500 |
| Sun wild | 63,267,942,204 | 50 / 250 / 1,000 |
| Moon scatter | 30,000,000,000 | No line payout |

The twenty active paylines each receive one twentieth of the total bet. Only the highest paying interpretation of a line wins; separate lines add. Line correlation changes variance but not the sum's expectation. Every line samples one independent cell from each of the five reels, so each has the same marginal symbol distribution. Summing twenty line expectations, each weighted by 1/20, gives the same expected total line return as the earlier ten-line game. The added patterns change which boards win and how often wins overlap, not the 98% theoretical RTP. Old settled awards are not recalculated.

The on-demand bonus demo uses the same star distribution in an isolated, nonpersistent session. It makes no wager and contributes no awards or free spins to normal play, so it is excluded from the normal game's RTP.

The number of Moon scatters follows Binomial(15, 0.025). Three, four, or five or more Moons grant 5, 8, or 12 free spins, plus a constellation match. Free spins have the same distribution, can retrigger, and preserve the originating wager.

Each star independently hides Mini (3 of 6 equally likely tickets), Minor (2 of 6), or Major (1 of 6). The first tier revealed three times pays 2x, 5x, or 20x total bet. All star rewards are fixed before choosing a constellation. Every map has at least seven stars; the pigeonhole principle guarantees a triple by the seventh reveal. Since unrevealed stars are independent, choosing a different constellation or click order cannot change the theoretical return.

Enumerating all `6^7 = 279,936` star-ticket sequences, stopping each at its first triple, gives:

| Winning tier | Weighted sequences | Total-bet multiplier |
| --- | ---: | ---: |
| Mini | 178,848 | 2 |
| Minor | 82,512 | 5 |
| Major | 18,576 | 20 |

The mean bonus multiplier is `(178848*2 + 82512*5 + 18576*20)/279936 = 4.078703703703703`. `analyzeStarMatch` calculates this recursively with exact integer weights; a separate test enumerates all ticket sequences independently.

## Verification

`npm run math` enumerates all **537,824** possible five-symbol lines and uses exact BigInt counts for the weighted outcomes, star matches, and binomial scatter distribution. Let `L` be line return per unit total bet, `P` the bonus-trigger probability, `J` the mean match multiplier, and `F` the expected number of new free spins per spin. Total return satisfies:

```text
R = L + P * J + F * R
R = (L + P * J) / (1 - F)

L = 0.9277045413783064
P = 0.0056740724642765136
J = 4.078703703703703
F = 0.02974754926079292
R = 0.9800000000299007
```

Finite integer ticket weights produce **98.0000000030% RTP**, which rounds to 98.00%; house edge is **1.9999999970%**. Tests bound the difference from 98% below `1e-9` in return ratio and independently verify the line expectation using a closed-form calculation. No outcome is adjusted based on a player's balance, history, constellation, star selection, or denomination.

All 40 wager/denomination combinations use integer-cent arithmetic with no payout rounding. Changing denomination changes the number of available credits, not the wallet's stored value. The model assumes earned free spins and bonus picks are played; abandoning them can reduce realized return.

Browser state is locally editable because this is a virtual-credit demo. The theoretical calculation applies to normal play, not manipulated state or inspection of the hidden deck in developer tools.
