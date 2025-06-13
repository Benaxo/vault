import { ethers } from "ethers";

/**
 * Extract goalId from GoalCreated event logs
 * @param {Array} logs - Transaction receipt logs
 * @returns {number|null} - The extracted goalId or null if not found
 */
export const extractGoalIdFromLogs = (logs) => {
  try {
    // New GoalCreated event signature with goalType and currency
    const newGoalCreatedTopic = ethers.id(
      "GoalCreated(address,uint256,uint8,uint256,uint8)"
    );

    // Legacy GoalCreated event signature (fallback)
    const legacyGoalCreatedTopic = ethers.id(
      "GoalCreated(address,uint256,uint256,uint256)"
    );

    // Try to find the new GoalCreated event first
    let goalCreatedLog = logs.find(
      (log) => log.topics[0] === newGoalCreatedTopic
    );

    // If not found, try the legacy format
    if (!goalCreatedLog) {
      goalCreatedLog = logs.find(
        (log) => log.topics[0] === legacyGoalCreatedTopic
      );
    }

    if (goalCreatedLog) {
      // goalId is the second indexed parameter (topics[2])
      const goalId = parseInt(goalCreatedLog.topics[2], 16);
      return goalId;
    }

    return null;
  } catch (error) {
    console.error("Error extracting goalId from logs:", error);
    return null;
  }
};

/**
 * Parse contract event data from transaction receipt
 * @param {Object} receipt - Transaction receipt
 * @param {string} eventName - Name of the event to parse
 * @returns {Object|null} - Parsed event data or null
 */
export const parseContractEvent = (receipt, eventName) => {
  try {
    // This is a simplified version. In a real app, you'd use the contract's interface
    // to properly decode events
    switch (eventName) {
      case "GoalCreated":
        return {
          goalId: extractGoalIdFromLogs(receipt.logs),
          // Add more fields as needed
        };
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error parsing ${eventName} event:`, error);
    return null;
  }
};

/**
 * Format Wei to ETH with specified decimal places
 * @param {string|number|BigInt} wei - Amount in Wei
 * @param {number} decimals - Number of decimal places (default: 4)
 * @returns {string} - Formatted ETH amount
 */
export const formatEth = (wei, decimals = 4) => {
  if (!wei) return "0";
  return (Number(wei) / 1e18).toFixed(decimals);
};

/**
 * Convert ETH to Wei
 * @param {string|number} eth - Amount in ETH
 * @returns {BigInt} - Amount in Wei
 */
export const ethToWei = (eth) => {
  if (!eth) return BigInt(0);
  return BigInt(Math.floor(parseFloat(eth) * 1e18));
};

/**
 * Format timestamp to readable date
 * @param {string|number} timestamp - Unix timestamp
 * @returns {string} - Formatted date string
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp || Number(timestamp) === 0) return "Not set";
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
};
