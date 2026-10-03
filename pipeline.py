"""Ordinary Python rules: raw bank records -> cleaned records -> monthly totals."""

import math
import re
import statistics
from datetime import date
from decimal import Decimal


def month_keys(today):
    """Six previous calendar months plus the current month, across year boundaries."""
    end = today.year * 12 + today.month - 1
    return [
