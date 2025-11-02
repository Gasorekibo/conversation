const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { analyzeWithGemini } = require('./helpers/geminiPromptFormat');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
const corsOptions = {
  origin: '*', 
  methods: 'GET,POST', 
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const conversations = new Map();
const INTENT_REQUIREMENTS = {
    place_order: ['product_name', 'quantity'],
    check_status: ['order_id'],
    search_products: []
};

function getBasicAuthHeader() {
    const auth = Buffer.from(
        `${process.env.CPI_CLIENT_ID}:${process.env.CPI_CLIENT_SECRET}`
    ).toString('base64');
    return `Basic ${auth}`;
}
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const sessionId = extractSessionId(req);
        const conversation = getConversation(sessionId);
        
        conversation.history.push({
            role: 'user',
            message: message,
            timestamp: new Date().toISOString()
        });
        
        const intentData = await analyzeWithGemini(message, conversation);
        updateConversationState(conversation, intentData);
        
        const missingInfo = getMissingInformation(conversation);
        let botResponse;
        let shouldCallBackend = false;
        
        if (missingInfo.length > 0) {
            botResponse = generateFollowUpQuestion(conversation, missingInfo[0]);
        } else if (!conversation.confirmed && conversation.intent !== 'search_products') {
            botResponse = generateConfirmation(conversation);
            conversation.awaiting_confirmation = true;
        } else if (intentData.intent === 'confirm' && conversation.awaiting_confirmation) {
            shouldCallBackend = true;
            botResponse = "Great! Processing your request...";
        } else if (intentData.intent === 'cancel') {
            resetConversation(conversation);
            botResponse = "No problem! I've cancelled that. How else can I help you?";
        } else {
            shouldCallBackend = true;
            botResponse = "Let me check that for you...";
        }
        
        conversation.history.push({
            role: 'assistant',
            message: botResponse,
            timestamp: new Date().toISOString()
        });

        let backendResult = null;
        let sessionDeleted = false;
        
        if (shouldCallBackend) {
            backendResult = await callBackendAPI(conversation);
            const resultMessage = formatBackendResponse(conversation.intent, backendResult);
            
            conversation.history.push({
                role: 'assistant',
                message: resultMessage,
                timestamp: new Date().toISOString()
            });
            
            botResponse = `${botResponse}\n\n${resultMessage}`;
            conversations.delete(sessionId);
            sessionDeleted = true;
        }

        if (!sessionDeleted) {
            res.cookie('session_id', sessionId, { 
                httpOnly: true, 
                maxAge: 3600000, // 1 hour
                sameSite: 'strict'
            });
            res.setHeader('X-Session-ID', sessionId);
        } else {
            res.clearCookie('session_id');
        }

        res.json({
            response: botResponse,
            intent: conversation.intent,
            collected_data: {
                product_name: conversation.product_name,
                quantity: conversation.quantity,
                order_id: conversation.order_id
            },
            awaiting_confirmation: conversation.awaiting_confirmation,
            backend_result: backendResult
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Something went wrong',
            details: error.message 
        });
    }
});

function extractSessionId(req) {
    if (req.cookies && req.cookies.session_id) {
        return req.cookies.session_id;
    }
    
    if (req.headers['x-session-id']) {
        return req.headers['x-session-id'];
    }
    
    if (req.body.session_id) {
        return req.body.session_id;
    }
    
    // Priority 4: Generate new session ID
    return uuidv4();
}

/**
 * Update conversation state with new information
 */
function updateConversationState(conversation, intentData) {
    if (intentData.intent !== 'provide_info' && intentData.intent !== 'confirm') {
        conversation.intent = intentData.intent;
    }
    
    if (intentData.product_name) {
        conversation.product_name = intentData.product_name;
    }
    if (intentData.quantity) {
        conversation.quantity = intentData.quantity;
    }
    if (intentData.order_id) {
        conversation.order_id = intentData.order_id;
    }
    
    if (intentData.intent === 'confirm') {
        conversation.confirmed = true;
    }
}

/**
 * Check what information is still missing
 */
function getMissingInformation(conversation) {
    const required = INTENT_REQUIREMENTS[conversation.intent] || [];
    const missing = [];
    
    for (const field of required) {
        if (!conversation[field]) {
            missing.push(field);
        }
    }
    
    return missing;
}

/**
 * Generate follow-up question for missing information
 */
function generateFollowUpQuestion(conversation, missingField) {
    const questions = {
        product_name: "What product would you like to order?",
        quantity: `How many ${conversation.product_name || 'items'} would you like?`,
        order_id: "What's your order ID? (e.g., #12345)"
    };
    
    return questions[missingField] || "Could you provide more details?";
}

/**
 * Generate confirmation message
 */
function generateConfirmation(conversation) {
    if (conversation.intent === 'place_order') {
        return `Just to confirm: You want to order ${conversation.quantity} ${conversation.product_name}(s). Is that correct?`;
    } else if (conversation.intent === 'check_status') {
        return `I'll check the status of order ${conversation.order_id}. Shall I proceed?`;
    }
    return "Is this information correct?";
}

/**
 * Reset conversation state
 */
function resetConversation(conversation) {
    conversation.intent = null;
    conversation.product_name = null;
    conversation.quantity = null;
    conversation.order_id = null;
    conversation.confirmed = false;
    conversation.awaiting_confirmation = false;
}

/**
 * Get or create conversation
 */
function getConversation(sessionId) {
    if (!conversations.has(sessionId)) {
        conversations.set(sessionId, {
            session_id: sessionId,
            intent: null,
            product_name: null,
            quantity: null,
            order_id: null,
            confirmed: false,
            awaiting_confirmation: false,
            history: [],
            created_at: new Date().toISOString()
        });
    }
    return conversations.get(sessionId);
}


async function callBackendAPI(conversation) {
    try {
        const authHeader = getBasicAuthHeader();
        if (conversation.intent === 'search_products') {
            const response = await axios.post(process.env.CPI_API_URL, conversation, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
            
        } else if (conversation.intent === 'place_order') {
            const response = await axios.post(process.env.CPI_API_URL, conversation, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
            
        } else if (conversation.intent === 'check_status') {
            const response = await axios.post(process.env.CPI_API_URL, conversation, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json'
                }
            });
            return response?.data?.backend_result;
        }
    } catch (error) {
        console.error('Backend API error:', error.message);
        return { error: 'Failed to process request', details: error.message };
    }
}

/**
 * Format backend response for user
 */
function formatBackendResponse(intent, result) {
    if (result?.error) {
        return `Sorry, I encountered an error: ${result.error}`;
    }
    
    if (intent === 'search_products') {
        if (result?.products && result.products.length > 0) {
            const productList = result.products.map(p => `- ${p.name} (${p.stock} in stock)`).join('\n');
            return `Here are our available products:\n${productList}`;
        }
        return "No products available at the moment.";
        
    } else if (intent === 'place_order') {
        return `Order placed successfully! Your order ID is: ${result.order_id || 'N/A'}`;
        
    } else if (intent === 'check_status') {
        return `Order Status: ${result.status || 'Unknown'}\nExpected delivery: ${result.delivery_date || 'N/A'}`;
    }
    
    return "Request processed successfully!";
}
function cleanupAbandonedConversations() {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = new Date();
    
    for (const [sessionId, conv] of conversations.entries()) {
        const lastActivity = conv.history.length > 0 
            ? new Date(conv.history[conv.history.length - 1].timestamp)
            : new Date(conv.created_at);
            
        if (now - lastActivity > ONE_HOUR) {
            console.log(`Cleaning up abandoned session: ${sessionId}`);
            conversations.delete(sessionId);
        }
    }
}

setInterval(cleanupAbandonedConversations, 30 * 60 * 1000);

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        active_conversations: conversations.size 
    });
});
app.get('/', (req,res)=> {
    res.send('Welcome to the Chatbot server!');
})
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Chatbot server running on port ${PORT}`);
});

module.exports = { app };