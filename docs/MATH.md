# Astral Fortune Return Model

The game targets **98.00% theoretical RTP**, or a **2.00% house edge**, for every supported credit bet and denomination. This includes all line wins, celestial picks, free spins, and recursively triggered bonuses. It is a mathematical expectation over long-run play, not a session guarantee or gambling certification.

## Distribution and Payouts

Each of the 15 cells is drawn independently using an unbiased `random-js` integer distribution driven by browser cryptographic randomness. There are 1,200,000,000,000 tickets per draw:

| Symbol | Tickets | 3 / 4 / 5 matches, per line bet |
| --- | ---: | --- |
| Each of 12 zodiac signs | 92,448,882,741 | 20 / 100 / 500 |
| Sun wild | 60,613,407,108 | 50 / 250 / 1,000 |
| Moon scatter | 30,000,000,000 | No line payout |

The ten active paylines each receive one tenth of the total bet. Only the highest paying interpretation of a line wins; separate lines add. Line correlation changes variance but not the sum's expectation.

The number of Moon scatters follows Binomial(15, 0.025). Three, four, or five or more Moons grant 5, 8, or 12 free spins, plus a sign pick. Free spins have the same distribution, can retrigger, and preserve the originating wager.

Each bonus shuffles six Mini prizes (2x), four Minor (5x), one Major (20x), and one Grand (100x) behind the twelve signs. Any chosen sign has expected payout `(6*2 + 4*5 + 20 + 100)/12 = 152/12` times total bet. The deck is fixed before selection. No sign-based strategy changes this expectation for an unrevealed deck.

## Verification

`npm run math` enumerates all **537,824** possible five-symbol lines and uses exact BigInt counts for the weighted outcomes and binomial scatter distribution. Let `L` be line return per unit total bet, `P` the bonus-trigger probability, `J` the mean pick multiplier, and `F` the expected number of new free spins per spin. Total return satisfies:

```text
R = L + P * J + F * R
R = (L + P * J) / (1 - F)

L = 0.8789758172621722
P = 0.0056740724642765136
J = 12.666666666666666
F = 0.02974754926079292
R = 0.9800000000878655
```

Finite integer ticket weights produce **98.0000000088% RTP**, which rounds to 98.00%; house edge is **1.9999999912%**. Tests bound the difference from 98% below `1e-9` in return ratio and independently verify the line expectation using a closed-form calculation. No outcome is adjusted based on a player's balance, history, sign choice, or denomination.

All 40 wager/denomination combinations use integer-cent arithmetic with no payout rounding. Changing denomination changes the number of available credits, not the wallet's stored value. The model assumes earned free spins and bonus picks are played; abandoning them can reduce realized return.

Browser state is locally editable because this is a virtual-credit demo. The theoretical calculation applies to normal play, not manipulated state or inspection of the hidden deck in developer tools.
