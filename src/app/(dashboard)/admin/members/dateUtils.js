// src/utils/dateUtils.js

/**
 * Calculates the end date of a subscription based on start date, plan, and duration.
 * @param {string} startDate - The start date in 'YYYY-MM-DD' format.
 * @param {string} planType - The type of the plan (e.g., 'oneMonth', 'year').
 * @param {number|null} duration - The duration in months, if provided.
 * @returns {string} The calculated end date in 'YYYY-MM-DD' format.
 */
export const calculateEndDate = (startDate, planType, duration) => {
    const start = new Date(startDate);
    let end = new Date(start);

    // Prefer explicit duration from plan fees if available
    if (duration) {
        end.setMonth(end.getMonth() + duration);
    } else {
        // Fallback for older or simpler plans
        switch(planType) {
            case 'oneMonth':
            case 'withoutReg':
                end.setMonth(end.getMonth() + 1);
                break;
            case 'threeMonth':
                end.setMonth(end.getMonth() + 3);
                break;
            case 'sixMonth':
                end.setMonth(end.getMonth() + 6);
                break;
            case 'year':
                end.setFullYear(end.getFullYear() + 1);
                break;
            default:
                // Default to one month if plan is unknown
                end.setMonth(end.getMonth() + 1);
        }
    }
    return end.toISOString().split('T')[0];
};