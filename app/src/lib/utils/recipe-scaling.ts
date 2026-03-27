/**
 * Scale recipe ingredients based on serving size adjustment
 */

interface ScaleResult {
  original: string;
  scaled: string;
}

/**
 * Parse a fraction string to decimal
 */
function parseFraction(fraction: string): number {
  const parts = fraction.split('/');
  if (parts.length === 2) {
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(fraction);
}

/**
 * Convert decimal to fraction (for better display)
 */
function toFraction(decimal: number): string {
  const tolerance = 0.01;

  // Common fractions
  const fractions = [
    [1, 2], [1, 3], [2, 3], [1, 4], [3, 4],
    [1, 8], [3, 8], [5, 8], [7, 8],
  ];

  for (const [num, den] of fractions) {
    if (Math.abs(decimal - num / den) < tolerance) {
      return `${num}/${den}`;
    }
  }

  // Check for whole numbers with fractions
  const whole = Math.floor(decimal);
  const remainder = decimal - whole;

  if (remainder > tolerance) {
    for (const [num, den] of fractions) {
      if (Math.abs(remainder - num / den) < tolerance) {
        return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
      }
    }
  }

  // Just return rounded decimal
  if (decimal < 0.1) {
    return decimal.toFixed(2);
  }
  return decimal.toFixed(1).replace(/\.0$/, '');
}

/**
 * Parse quantity from ingredient string
 */
function parseQuantity(ingredientStr: string): {
  quantity: number | null;
  rest: string;
} {
  const text = ingredientStr.trim();

  // Pattern: [quantity] [rest of ingredient]
  // Handle: "1", "1.5", "1/2", "1 1/2", "1-1/2"
  const patterns = [
    /^(\d+[\s-]+\d+\/\d+)\s+(.+)$/, // Mixed: "1 1/2 cups"
    /^(\d+\/\d+)\s+(.+)$/, // Fraction: "1/2 cup"
    /^([\d.]+)\s+(.+)$/, // Decimal/whole: "2 cups"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const quantityStr = match[1];
      const rest = match[2];

      // Parse quantity
      let quantity: number;
      if (quantityStr.includes(' ') || quantityStr.includes('-')) {
        // Mixed number
        const parts = quantityStr.split(/[\s-]+/);
        quantity = parseInt(parts[0]) + parseFraction(parts[1]);
      } else if (quantityStr.includes('/')) {
        quantity = parseFraction(quantityStr);
      } else {
        quantity = parseFloat(quantityStr);
      }

      return { quantity, rest };
    }
  }

  return { quantity: null, rest: text };
}

/**
 * Scale a single ingredient
 */
export function scaleIngredient(ingredient: string, scaleFactor: number): ScaleResult {
  const { quantity, rest } = parseQuantity(ingredient);

  if (quantity === null) {
    // No quantity found, return as-is
    return {
      original: ingredient,
      scaled: ingredient,
    };
  }

  const scaledQuantity = quantity * scaleFactor;
  const scaledStr = toFraction(scaledQuantity);

  return {
    original: ingredient,
    scaled: `${scaledStr} ${rest}`,
  };
}

/**
 * Scale all ingredients in a recipe
 */
export function scaleRecipe(
  ingredients: string[],
  originalServings: number,
  newServings: number
): string[] {
  const scaleFactor = newServings / originalServings;
  return ingredients.map((ing) => scaleIngredient(ing, scaleFactor).scaled);
}

/**
 * Get scaling factor from servings
 */
export function getScaleFactor(originalServings: number, newServings: number): number {
  return newServings / originalServings;
}
