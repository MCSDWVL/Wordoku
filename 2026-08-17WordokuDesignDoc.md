# Wordoku Design Doc
Wordoku is a static browser game that combines elements of Sodoku and Word games.

The field of play consists of a large square made up of smaller squares, with
several colored regions. Each smaller square contains a letter.

The goal of play is for users to find the word that is spelled with:
- EXACTLY one letter from each colored region
- AT MOST one letter per row (some rows can have 0 letters)
- AT MOST one letter per column (some columns can have 0 letters)


So for example, if there are 5 colored regions, the user is looking for
a five letter word, and must find it by looking for one letter in each
region that does not share a row or column with the other letters.

Players are able to place an "X" on any square they suspect is not a valid
letter by clicking on it. This is just to aid them in thinking, and has
no gameplay impact.

To complete play, users hit a button to enter a guess, and type in what they believe
the word is. If they are correct, the letters are highlighted and they are notified
of their success. If they fail, they should just be told they failed and allowed
to keep playing.

The goal should be to generate puzzles with 1 unique solution, but if the user
finds another valid solution, it should be accepted. So scoring their submission
should check the validity of their word, not just check it matches the intended
solution.

The game is implemented in javascript and HTML as a single page, with a daily
seed derived from UTC. We should have the option to append ?seed=x to test
though.

There are dictionary resources for valid words available in nearby folders, here:
- "T:\OtherProjects\Lexicon\dictionary.txt"
