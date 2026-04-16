#!/usr/bin/env python3
"""
Chess board OCR: extract FEN from chess board diagram images.
Analyzes each square by color distribution to identify pieces.

Strategy:
1. Divide board image into 8x8 grid
2. For each square, analyze pixel colors:
   - Empty square: two dominant colors (light/dark board colors only)
   - White piece on light square: mostly white/gray pixels + light board
   - White piece on dark square: mostly white/gray pixels + dark board
   - Black piece on light square: mostly dark/black pixels + light board
   - Black piece on dark square: mostly dark/black pixels + dark board
3. Use the unique color signature of each piece type to classify
4. Validate with chess.js (legal position, kings present, etc.)

Usage: python3 scripts/chess-ocr.py <image_path> [--side white|black]
"""

import sys
import os
import json
from PIL import Image
import numpy as np

# Piece identification by analyzing the shape of colored pixels
# We use template matching: compare the pattern of piece pixels against known templates

def get_square_img(board_img, row, col, sq_size):
    """Extract a single square from the board image."""
    x = col * sq_size
    y = row * sq_size
    # Add small margin to avoid border artifacts
    margin = max(2, sq_size // 20)
    return board_img.crop((x + margin, y + margin, x + sq_size - margin, y + sq_size - margin))

def is_light_square(row, col):
    """Check if a board position is a light square."""
    return (row + col) % 2 == 0

def analyze_square(square_img):
    """Analyze a square image to determine if there's a piece and its type.
    
    Returns: (has_piece, piece_color, confidence)
    - has_piece: bool
    - piece_color: 'white' | 'black' | None
    - confidence: float 0-1
    """
    arr = np.array(square_img)
    
    # Get pixel statistics
    # Convert to grayscale for easier analysis
    if len(arr.shape) == 3:
        gray = np.mean(arr, axis=2)
    else:
        gray = arr.astype(float)
    
    total_pixels = gray.size
    
    # Classify pixels into categories:
    # Very dark (< 50): piece black pixels
    # Dark (50-120): dark board / piece dark tones
    # Medium (120-180): piece gray tones / board mid
    # Light (180-230): piece white tones / board light
    # Very light (> 230): highlights / board very light
    
    very_dark = np.sum(gray < 50) / total_pixels
    dark = np.sum((gray >= 50) & (gray < 120)) / total_pixels
    medium = np.sum((gray >= 120) & (gray < 180)) / total_pixels
    light = np.sum((gray >= 180) & (gray < 230)) / total_pixels
    very_light = np.sum(gray >= 230) / total_pixels
    
    # Empty square detection:
    # Light square: mostly very_light + some medium
    # Dark square: mostly medium + dark
    
    # Piece detection heuristic:
    # A piece creates a bimodal distribution (piece color + board color showing through)
    
    # Check for white piece: high very_light AND significant very_dark/medium (piece outline)
    has_white_piece = (very_light > 0.15) and (dark > 0.08 or very_dark > 0.02)
    
    # Check for black piece: high very_dark + dark, low very_light
    has_black_piece = (very_dark > 0.05) and (very_light < 0.15)
    
    # Empty square: mostly one or two adjacent ranges
    is_empty_light = (very_light > 0.5) and not has_white_piece and not has_black_piece
    is_empty_dark = (dark > 0.3 or medium > 0.5) and (very_light < 0.2) and not has_white_piece and not has_black_piece
    
    if has_white_piece and not has_black_piece:
        return True, 'white', min(1.0, very_light + dark)
    elif has_black_piece and not has_white_piece:
        return True, 'black', min(1.0, very_dark + dark)
    elif has_white_piece and has_black_piece:
        # Ambiguous - use which is more dominant
        if very_light > very_dark:
            return True, 'white', 0.5
        else:
            return True, 'black', 0.5
    else:
        return False, None, 0.8


def classify_piece_type(square_img, piece_color, is_light):
    """Try to classify the piece type by analyzing the shape.
    
    Uses a simplified approach: count the spread and density of piece pixels
    to distinguish between different piece types.
    
    Returns: piece character (K, Q, R, B, N, P) or None
    """
    arr = np.array(square_img)
    if len(arr.shape) == 3:
        gray = np.mean(arr, axis=2)
    else:
        gray = arr.astype(float)
    
    h, w = gray.shape
    
    # Determine piece pixels based on color
    if piece_color == 'white':
        # White pieces: bright pixels with dark outlines
        piece_mask = (gray > 180) | (gray < 50)
        body_mask = gray > 180
        outline_mask = gray < 50
    else:
        # Black pieces: dark pixels
        piece_mask = gray < 80
        body_mask = gray < 80
        outline_mask = gray < 30
    
    if not np.any(piece_mask):
        return 'P'  # Default to pawn if we can't tell
    
    # Analyze piece shape characteristics
    piece_pixels = np.sum(piece_mask)
    total_pixels = h * w
    fill_ratio = piece_pixels / total_pixels
    
    # Find bounding box of piece
    rows_with_piece = np.any(piece_mask, axis=1)
    cols_with_piece = np.any(piece_mask, axis=0)
    
    if not np.any(rows_with_piece) or not np.any(cols_with_piece):
        return 'P'
    
    row_min = np.argmax(rows_with_piece)
    row_max = len(rows_with_piece) - np.argmax(rows_with_piece[::-1]) - 1
    col_min = np.argmax(cols_with_piece)
    col_max = len(cols_with_piece) - np.argmax(cols_with_piece[::-1]) - 1
    
    piece_height = row_max - row_min + 1
    piece_width = col_max - col_min + 1
    
    aspect = piece_width / max(piece_height, 1)
    
    # Height relative to square
    height_ratio = piece_height / h
    
    # Analyze top portion (head) vs bottom (base)
    mid_row = (row_min + row_max) // 2
    top_density = np.sum(piece_mask[row_min:mid_row, :]) / max(np.sum(np.ones_like(piece_mask[row_min:mid_row, :])), 1)
    bottom_density = np.sum(piece_mask[mid_row:row_max+1, :]) / max(np.sum(np.ones_like(piece_mask[mid_row:row_max+1, :])), 1)
    
    # Cross-section at different heights
    top_quarter = row_min + piece_height // 4
    mid_point = row_min + piece_height // 2
    three_quarter = row_min + 3 * piece_height // 4
    
    def row_width(r):
        if r >= h: return 0
        return np.sum(piece_mask[r, :])
    
    width_at_top = row_width(top_quarter)
    width_at_mid = row_width(mid_point)
    width_at_bottom = row_width(three_quarter)
    
    # Classification heuristics
    # Pawn: small, narrow top, wider base, low fill
    # Rook: flat top, rectangular, medium fill
    # Knight: asymmetric, medium fill, wider mid
    # Bishop: pointed top, medium width, medium fill  
    # Queen: pointed top with wider body, high fill
    # King: tall, cross on top, high fill
    
    # Simple heuristic based on fill ratio and dimensions
    if fill_ratio < 0.15:
        return 'P'  # Pawn - smallest piece
    elif fill_ratio > 0.35 and height_ratio > 0.8:
        return 'K'  # King - largest, tallest
    elif fill_ratio > 0.3 and aspect > 0.7:
        return 'Q'  # Queen - large, wide
    elif width_at_top > width_at_mid * 0.8 and height_ratio > 0.7:
        return 'R'  # Rook - flat top, tall
    elif abs(aspect - 0.7) < 0.15 and height_ratio > 0.7:
        return 'N'  # Knight - distinctive shape
    elif height_ratio > 0.75 and fill_ratio < 0.25:
        return 'B'  # Bishop - tall and narrow
    else:
        return 'P'  # Default to pawn


def board_image_to_fen(board_img_path, side_to_move='white', orientation='white'):
    """Convert a chess board image to FEN string.
    
    Args:
        board_img_path: Path to the board image
        side_to_move: Which side has the move ('white' or 'black')
        orientation: Board orientation ('white' or 'black' at bottom)
    
    Returns:
        FEN string (position only, no castling/move counters)
    """
    img = Image.open(board_img_path)
    sq_size = img.width // 8
    
    pieces = []
    piece_map = {
        ('white', 'K'): 'K', ('white', 'Q'): 'Q', ('white', 'R'): 'R',
        ('white', 'B'): 'B', ('white', 'N'): 'N', ('white', 'P'): 'P',
        ('black', 'K'): 'k', ('black', 'Q'): 'q', ('black', 'R'): 'r',
        ('black', 'B'): 'b', ('black', 'N'): 'n', ('black', 'P'): 'p',
    }
    
    fen_rows = []
    
    for row in range(8):
        fen_row = ''
        empty_count = 0
        
        for col in range(8):
            # Determine actual board position based on orientation
            if orientation == 'white':
                board_row = 7 - row  # row 0 = rank 8
                board_col = col      # col 0 = file a
            else:
                board_row = row
                board_col = 7 - col
            
            square_img = get_square_img(img, row, col, sq_size)
            is_light = is_light_square(board_row, board_col)
            
            has_piece, piece_color, confidence = analyze_square(square_img)
            
            if has_piece:
                # Save debug info
                piece_type = classify_piece_type(square_img, piece_color, is_light)
                piece_char = piece_map.get((piece_color, piece_type), '?')
                
                if empty_count > 0:
                    fen_row += str(empty_count)
                    empty_count = 0
                fen_row += piece_char
            else:
                empty_count += 1
        
        if empty_count > 0:
            fen_row += str(empty_count)
        
        fen_rows.append(fen_row)
    
    fen_position = '/'.join(fen_rows)
    side_char = 'w' if side_to_move == 'white' else 'b'
    fen = f'{fen_position} {side_char} - - 0 1'
    
    return fen


# Main
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 chess-ocr.py <image_path> [--side white|black] [--orientation white|black]")
        sys.exit(1)
    
    img_path = sys.argv[1]
    side = 'white'
    orientation = 'white'
    
    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == '--side' and i + 1 < len(sys.argv):
            side = sys.argv[i + 1]
        elif arg == '--orientation' and i + 1 < len(sys.argv):
            orientation = sys.argv[i + 1]
    
    fen = board_image_to_fen(img_path, side, orientation)
    print(fen)
