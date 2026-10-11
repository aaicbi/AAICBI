-- Posts can be disliked as well as liked.
ALTER TYPE "PostReactionKind" ADD VALUE IF NOT EXISTS 'DISLIKE';
