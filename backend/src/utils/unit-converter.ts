/**
 * Intelligent unit conversion utility for recipe ingredients
 * Handles imperial to metric conversions with context awareness
 */

// Common ingredient densities (g/ml) for volume to weight conversion
const INGREDIENT_DENSITIES: Record<string, number> = {
  // Liquids
  water: 1.0,
  milk: 1.03,
  cream: 1.01,
  oil: 0.92,
  'vegetable oil': 0.92,
  'olive oil': 0.92,
  honey: 1.42,
  syrup: 1.37,
  'maple syrup': 1.37,
  molasses: 1.4,

  // Dry ingredients
  flour: 0.53,
  'all-purpose flour': 0.53,
  'bread flour': 0.55,
  'cake flour': 0.45,
  sugar: 0.85,
  'granulated sugar': 0.85,
  'brown sugar': 0.9,
  'powdered sugar': 0.56,
  'confectioners sugar': 0.56,
  salt: 1.22,
  'table salt': 1.22,
  'kosher salt': 0.85,

  // Fats
  butter: 0.96,
  margarine: 0.96,
  shortening: 0.82,
  lard: 0.92,

  // Powders
  'baking powder': 0.48,
  'baking soda': 0.96,
  cocoa: 0.53,
  'cocoa powder': 0.53,

  // Default for unknowns
  default: 0.8,
};

// Volume conversions to ml
const VOLUME_CONVERSIONS: Record<string, number> = {
  // US customary
  'cup': 236.588,
  'cups': 236.588,
  'c': 236.588,
  'tablespoon': 14.787,
  'tablespoons': 14.787,
  'tbsp': 14.787,
  'tbs': 14.787,
  'tb': 14.787,
  'T': 14.787,
  'teaspoon': 4.929,
  'teaspoons': 4.929,
  'tsp': 4.929,
  't': 4.929,
  'fluid ounce': 29.574,
  'fluid ounces': 29.574,
  'fl oz': 29.574,
  'fl. oz.': 29.574,
  'pint': 473.176,
  'pints': 473.176,
  'pt': 473.176,
  'quart': 946.353,
  'quarts': 946.353,
  'qt': 946.353,
  'gallon': 3785.41,
  'gallons': 3785.41,
  'gal': 3785.41,

  // Metric (pass through)
  'milliliter': 1,
  'milliliters': 1,
  'ml': 1,
  'liter': 1000,
  'liters': 1000,
  'l': 1000,
};

// Weight conversions to grams
const WEIGHT_CONVERSIONS: Record<string, number> = {
  // Imperial
  'ounce': 28.3495,
  'ounces': 28.3495,
  'oz': 28.3495,
  'pound': 453.592,
  'pounds': 453.592,
  'lb': 453.592,
  'lbs': 453.592,

  // Metric (pass through)
  'gram': 1,
  'grams': 1,
  'g': 1,
  'kilogram': 1000,
  'kilograms': 1000,
  'kg': 1000,
};

interface ParsedIngredient {
  original: string;
  quantity: number | null;
  unit: string | null;
  ingredient: string;
  converted?: string;
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
 * Parse quantity from various formats
 * Examples: "1", "1.5", "1/2", "1 1/2", "1-1/2"
 */
function parseQuantity(quantityStr: string): number | null {
  quantityStr = quantityStr.trim();

  // Handle mixed numbers: "1 1/2" or "1-1/2"
  const mixedMatch = quantityStr.match(/^(\d+)[\s-]+(\d+\/\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const fraction = parseFraction(mixedMatch[2]);
    return whole + fraction;
  }

  // Handle fractions: "1/2"
  if (quantityStr.includes('/')) {
    return parseFraction(quantityStr);
  }

  // Handle decimals or whole numbers
  const num = parseFloat(quantityStr);
  return isNaN(num) ? null : num;
}

/**
 * Extract ingredient name from the text after unit
 */
function extractIngredientName(text: string): string {
  // Remove common prepositions and clean up
  return text
    .replace(/^(of\s+|for\s+)/i, '')
    .replace(/,\s*(optional|divided|plus more for).*$/i, '')
    .trim();
}

/**
 * Parse an ingredient string
 */
export function parseIngredient(ingredientStr: string): ParsedIngredient {
  const original = ingredientStr;
  let text = ingredientStr.toLowerCase().trim();

  // Pattern: [quantity] [unit] [ingredient]
  // Examples: "2 cups flour", "1/2 cup sugar", "8 oz cream cheese"
  const pattern = /^([\d\s\/.-]+)\s*([a-zA-Z.]+)?\s*(.+)$/;
  const match = text.match(pattern);

  if (!match) {
    // No quantity found, return as-is
    return {
      original,
      quantity: null,
      unit: null,
      ingredient: ingredientStr.trim(),
    };
  }

  const [, quantityStr, unitStr, ingredientPart] = match;
  const quantity = parseQuantity(quantityStr);
  const unit = unitStr?.trim() || null;
  const ingredient = extractIngredientName(ingredientPart);

  return {
    original,
    quantity,
    unit,
    ingredient,
  };
}

/**
 * Get ingredient density, trying to match against known ingredients
 */
function getIngredientDensity(ingredientName: string): number {
  const lower = ingredientName.toLowerCase();

  // Try exact match first
  if (INGREDIENT_DENSITIES[lower]) {
    return INGREDIENT_DENSITIES[lower];
  }

  // Try partial match
  for (const [key, density] of Object.entries(INGREDIENT_DENSITIES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return density;
    }
  }

  return INGREDIENT_DENSITIES.default;
}

/**
 * Convert a parsed ingredient to metric
 */
export function convertIngredientToMetric(parsed: ParsedIngredient): ParsedIngredient {
  const { quantity, unit, ingredient } = parsed;

  if (!quantity || !unit) {
    // Can't convert without quantity and unit
    return parsed;
  }

  const lowerUnit = unit.toLowerCase().replace(/\./g, '');

  // Check if it's a volume unit
  if (VOLUME_CONVERSIONS[lowerUnit]) {
    const ml = quantity * VOLUME_CONVERSIONS[lowerUnit];

    // For large volumes, use liters
    if (ml >= 1000) {
      const liters = (ml / 1000).toFixed(2).replace(/\.?0+$/, '');
      return {
        ...parsed,
        converted: `${liters} L ${ingredient}`,
      };
    }

    // For standard volumes, use ml
    const roundedMl = Math.round(ml);
    return {
      ...parsed,
      converted: `${roundedMl} ml ${ingredient}`,
    };
  }

  // Check if it's a weight unit
  if (WEIGHT_CONVERSIONS[lowerUnit]) {
    const grams = quantity * WEIGHT_CONVERSIONS[lowerUnit];

    // For large weights, use kg
    if (grams >= 1000) {
      const kg = (grams / 1000).toFixed(2).replace(/\.?0+$/, '');
      return {
        ...parsed,
        converted: `${kg} kg ${ingredient}`,
      };
    }

    // For standard weights, use grams
    const roundedGrams = Math.round(grams);
    return {
      ...parsed,
      converted: `${roundedGrams} g ${ingredient}`,
    };
  }

  // Unknown unit, return as-is
  return parsed;
}

/**
 * Convert an ingredient string from imperial to metric
 */
export function convertIngredient(ingredientStr: string): string {
  const parsed = parseIngredient(ingredientStr);
  const converted = convertIngredientToMetric(parsed);
  return converted.converted || converted.original;
}

/**
 * Clean up dual measurements (e.g., "10 ml / 6 g" → "6 g")
 * Prefers weight over volume when both are present
 */
function cleanDualMeasurements(ingredientStr: string): string {
  // Pattern: quantity unit / quantity unit ingredient
  // Example: "10 ml / 6 g active dry yeast" → "6 g active dry yeast"
  const dualPattern = /^([\d\s\/.-]+)\s*([a-zA-Z.]+)\s*\/\s*([\d\s\/.-]+)\s*([a-zA-Z.]+)\s+(.+)$/i;
  const match = ingredientStr.match(dualPattern);

  if (match) {
    const [, qty1, unit1, qty2, unit2, ingredient] = match;
    const lowerUnit1 = unit1.toLowerCase().replace(/\./g, '');
    const lowerUnit2 = unit2.toLowerCase().replace(/\./g, '');

    // Prefer weight (g, kg) over volume (ml, L)
    const isWeight1 = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms'].includes(lowerUnit1);
    const isWeight2 = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms'].includes(lowerUnit2);

    if (isWeight2) {
      // Use the second measurement (weight)
      return `${qty2.trim()} ${unit2.trim()} ${ingredient.trim()}`;
    } else if (isWeight1) {
      // Use the first measurement (weight)
      return `${qty1.trim()} ${unit1.trim()} ${ingredient.trim()}`;
    } else {
      // Both are volume or other, use second one
      return `${qty2.trim()} ${unit2.trim()} ${ingredient.trim()}`;
    }
  }

  return ingredientStr;
}

/**
 * Clean up range measurements (e.g., "1-2 cups" → "1.5 cups")
 * Also handles "± ¼ cup" patterns
 */
function cleanRangeMeasurements(ingredientStr: string): string {
  // Remove optional additions like "± ¼ cup"
  let cleaned = ingredientStr.replace(/\s*[±+]\s*[\d\s\/.-]+\s*[a-zA-Z.]+.*?(?=\)|$)/gi, '');

  // Remove parenthetical notes
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');

  // Convert ranges to average: "1-2 cups" → "1.5 cups"
  const rangePattern = /^([\d.]+)\s*[-–]\s*([\d.]+)(\s+[a-zA-Z.]+\s+.+)$/i;
  const rangeMatch = cleaned.match(rangePattern);

  if (rangeMatch) {
    const [, num1, num2, rest] = rangeMatch;
    const avg = (parseFloat(num1) + parseFloat(num2)) / 2;
    return `${formatNumber(avg)}${rest}`;
  }

  return cleaned.trim();
}

/**
 * Normalize fractions to a consistent format
 */
function normalizeFractions(ingredientStr: string): string {
  // Convert vulgar fractions to standard format
  const vulgarFractions: Record<string, string> = {
    '¼': '1/4',
    '½': '1/2',
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
  };

  let result = ingredientStr;
  for (const [vulgar, standard] of Object.entries(vulgarFractions)) {
    result = result.replace(new RegExp(vulgar, 'g'), standard);
  }

  return result;
}

/**
 * Clean and normalize an ingredient string
 */
export function cleanIngredient(ingredientStr: string): string {
  let cleaned = ingredientStr.trim();

  // Step 1: Normalize fractions
  cleaned = normalizeFractions(cleaned);

  // Step 2: Clean dual measurements
  cleaned = cleanDualMeasurements(cleaned);

  // Step 3: Clean ranges and optional measurements
  cleaned = cleanRangeMeasurements(cleaned);

  // Step 4: Remove "Optional Toppings:" type labels
  cleaned = cleaned.replace(/^(optional\s+)?[\w\s]+:\s*/gi, '');

  // Step 5: Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Convert all ingredients in a recipe
 */
export function convertRecipeIngredients(ingredients: string[]): string[] {
  return ingredients
    .map(cleanIngredient)
    .filter(ing => ing.length > 0) // Remove empty strings
    .map(convertIngredient);
}

/**
 * Clean and normalize an instruction string
 * Normalizes fractions and cleans up formatting
 */
export function cleanInstruction(instructionStr: string): string {
  let cleaned = instructionStr.trim();

  // Normalize fractions
  cleaned = normalizeFractions(cleaned);

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Convert measurements in instructions to metric
 */
export function convertInstructionMeasurements(instructionStr: string): string {
  let result = instructionStr;

  // First, clean up dual measurements in instructions (similar to ingredients)
  // Pattern: "118 ml /120ml" or "59 ml/60ml"
  const dualMeasurementPattern = /([\d\s\/.-]+)\s*(ml|l|g|kg|cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?)\s*\/\s*([\d\s\/.-]+)\s*(ml|l|g|kg|cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?)/gi;

  result = result.replace(dualMeasurementPattern, (match, qty1, unit1, qty2, unit2) => {
    const lowerUnit1 = unit1.toLowerCase().replace(/\./g, '');
    const lowerUnit2 = unit2.toLowerCase().replace(/\./g, '');

    // Prefer weight over volume, or metric over imperial
    const metricUnits = ['ml', 'l', 'g', 'kg'];
    const isMetric1 = metricUnits.includes(lowerUnit1);
    const isMetric2 = metricUnits.includes(lowerUnit2);

    if (isMetric2) {
      // Use the second measurement (metric)
      return `${qty2.trim()} ${unit2.trim()}`;
    } else if (isMetric1) {
      // Use the first measurement (metric)
      return `${qty1.trim()} ${unit1.trim()}`;
    } else {
      // Both non-metric, use second
      return `${qty2.trim()} ${unit2.trim()}`;
    }
  });

  // Pattern to find measurements in instructions
  // Matches things like "2 cups", "1/2 cup", "350°F", "8 oz"
  // Also handles edge cases like "about59 ml" by adding optional word boundary
  const measurementPattern = /(\b(?:about|scant)?\s*)([\d\s\/.-]+)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|°F|fahrenheit)/gi;

  result = result.replace(measurementPattern, (match, prefix, quantity, unit) => {
    const lowerUnit = unit.toLowerCase().replace(/\./g, '');

    // Handle temperature
    if (lowerUnit === '°f' || lowerUnit === 'fahrenheit') {
      const fahrenheit = parseFloat(quantity);
      if (!isNaN(fahrenheit)) {
        const celsius = Math.round((fahrenheit - 32) * 5 / 9);
        return `${prefix}${celsius}°C`;
      }
    }

    // Handle volume/weight - try to convert
    const parsed = parseIngredient(`${quantity} ${unit} placeholder`);
    if (parsed.quantity && parsed.unit) {
      const converted = convertIngredientToMetric(parsed);
      if (converted.converted) {
        // Extract just the measurement part (not the ingredient name)
        const measurement = converted.converted.replace(' placeholder', '');
        return `${prefix}${measurement}`;
      }
    }

    return match;
  });

  // Fix spacing issues where measurements got concatenated
  // e.g., "In118 ml" → "In 118 ml"
  result = result.replace(/([a-zA-Z])(\d+\s*(?:ml|l|g|kg))/g, '$1 $2');

  // Fix double spaces
  result = result.replace(/\s+/g, ' ');

  return result;
}

/**
 * Clean all instructions in a recipe
 */
export function cleanRecipeInstructions(instructions: string[], convertToMetric: boolean = false): string[] {
  return instructions
    .map(cleanInstruction)
    .map(inst => convertToMetric ? convertInstructionMeasurements(inst) : inst)
    .filter(inst => inst.length > 0);
}

/**
 * Format a number for display (remove trailing zeros)
 */
function formatNumber(num: number): string {
  return num.toFixed(2).replace(/\.?0+$/, '');
}
