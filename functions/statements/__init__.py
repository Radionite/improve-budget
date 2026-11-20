"""Inlezen van bankafschriften."""

from .model import ParsedStatement, Transaction
from .detect import parse_statement

__all__ = ["ParsedStatement", "Transaction", "parse_statement"]
