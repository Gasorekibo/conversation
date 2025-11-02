const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY 
const GEMINI_API_URL = process.env.GEMINI_API_URL
async function analyzeWithGemini(message, conversation) {
    const prompt = buildGeminiPrompt(message, conversation);
    
    try {
        const response = await axios.post(
            GEMINI_API_URL,
            {
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }]
            },
            {
                headers: {
                    'x-goog-api-key': GEMINI_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = response.data.candidates[0].content.parts[0].text;
        
        // Extract JSON from response (handle markdown code blocks)
        let jsonText = aiResponse.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }
        
        return JSON.parse(jsonText);
        
    } catch (error) {
        console.error('Gemini API error:', error.response?.data || error.message);
        // Fallback response
        return {
            intent: 'unknown',
            product_name: null,
            quantity: null,
            order_id: null,
            confidence: 'low'
        };
    }
}

/**
 * Build prompt for Gemini
 */
function buildGeminiPrompt(message, conversation) {
    let prompt = `You are analyzing a user message in a conversational chatbot for an e-commerce system.\n\n`;
    prompt += `User message: "${message}"\n\n`;
    
    if (conversation.intent) {
        prompt += `CONVERSATION CONTEXT:\n`;
        prompt += `- Current intent: ${conversation.intent}\n`;
        prompt += `- Product name: ${conversation.product_name || 'not provided'}\n`;
        prompt += `- Quantity: ${conversation.quantity || 'not provided'}\n`;
        prompt += `- Order ID: ${conversation.order_id || 'not provided'}\n`;
        prompt += `- Awaiting confirmation: ${conversation.awaiting_confirmation}\n\n`;
    }
    
    prompt += `TASK: Analyze the message and return a JSON object with:\n\n`;
    prompt += `1. intent: Identify the primary intent:\n`;
    prompt += `   - "search_products": User wants to see available products\n`;
    prompt += `   - "place_order": User wants to make a purchase\n`;
    prompt += `   - "check_status": User wants to check order status\n`;
    prompt += `   - "confirm": User is confirming (yes, correct, proceed, ok, etc.)\n`;
    prompt += `   - "cancel": User wants to cancel or start over\n`;
    prompt += `   - "provide_info": User is providing requested information\n`;
    prompt += `   - "unknown": Cannot determine intent\n\n`;
    
    prompt += `2. Extract entities (set to null if not mentioned):\n`;
    prompt += `   - product_name: Name of product (e.g., "laptop", "iPhone 14")\n`;
    prompt += `   - quantity: Number of items (convert words to numbers: "three" → 3)\n`;
    prompt += `   - order_id: Order identifier (e.g., "#12345", "ORD-789")\n\n`;
    
    prompt += `3. confidence: "high", "medium", or "low"\n\n`;
    
    prompt += `IMPORTANT:\n`;
    prompt += `- If awaiting confirmation and user says yes/ok/correct, set intent to "confirm"\n`;
    prompt += `- If user provides information that was missing, extract it even if intent seems different\n`;
    prompt += `- Be flexible with product names and handle typos\n`;
    prompt += `- Convert text numbers to numeric values\n\n`;
    
    prompt += `Return ONLY a valid JSON object (no markdown, no explanations):\n`;
    prompt += `{\n`;
    prompt += `  "intent": "string",\n`;
    prompt += `  "product_name": "string or null",\n`;
    prompt += `  "quantity": number or null,\n`;
    prompt += `  "order_id": "string or null",\n`;
    prompt += `  "confidence": "high|medium|low"\n`;
    prompt += `}`;
    
    return prompt;
}
module.exports = {
    analyzeWithGemini
};