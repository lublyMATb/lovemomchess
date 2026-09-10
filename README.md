# Chess — Full Local 2 Player

A static HTML/CSS/JavaScript chess game ready for GitHub Pages.

## Features

- Local 2-player chess on one device
- Legal move validation
- Check
- Checkmate
- Stalemate
- Castling
- En passant
- Pawn promotion (Queen, Rook, Bishop, Knight)
- 50-move draw rule
- Captured pieces
- Move history
- Undo
- Flip board
- Responsive layout
- No external libraries

## Run locally

Open `index.html` in your browser.

## Deploy to GitHub Pages

1. Create a GitHub repository, for example `chess`.
2. Upload:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
   - `SECURITY.md`
3. Open repository **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Choose `main` and `/ (root)`.
6. Save.

Your site will be available at:

`https://YOUR_USERNAME.github.io/chess/`

## Security

See `SECURITY.md`.


## v2 visual changes

- All 64 board cells are forced to exactly equal square dimensions.
- White pieces are solid white with a dark outline.
- Black pieces are solid near-black with a subtle light outline so they remain visible on dark squares.
