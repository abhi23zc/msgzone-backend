// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    businessName: {
        type: String,
        required: [true, 'Business name is required']
    },
    whatsappNumber: {
        type: String,
        required: [true, 'WhatsApp number is required'],
        unique: true
    },
    alternateNumber: {
        type: String
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    address: {
        type: String
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    religion: {
        type: String
    },
    birthdate: {
        type: Date
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    profilePhoto: {
        type: String
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

// models/Plan.js
const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        unique: true
    },
    type: {
        type: String,
        enum: ['Day-wise', 'Msg Count', 'Scheme-wise', 'Multi-Device'],
        required: [true, 'Plan type is required']
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: [true, 'Price is required']
    },
    validityDays: {
        type: Number,
        required: [true, 'Validity period is required']
    },
    messageLimit: {
        type: Number
    },
    deviceLimit: {
        type: Number,
        default: 1
    },
    features: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Plan', PlanSchema);

// models/UserPlan.js
const mongoose = require('mongoose');

const UserPlanSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    messagesRemaining: {
        type: Number
    },
    paymentId: {
        type: String
    },
    paymentAmount: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('UserPlan', UserPlanSchema);

// models/WhatsappDevice.js
const mongoose = require('mongoose');

const WhatsappDeviceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deviceName: {
        type: String,
        required: true
    },
    whatsappNumber: {
        type: String,
        required: true
    },
    qrCode: {
        type: String
    },
    sessionData: {
        type: String
    },
    status: {
        type: String,
        enum: ['connected', 'disconnected', 'pending'],
        default: 'pending'
    },
    lastConnected: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('WhatsappDevice', WhatsappDeviceSchema);

// models/MessageTemplate.js
const mongoose = require('mongoose');

const MessageTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Template name is required']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MessageTemplate', MessageTemplateSchema);

// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    whatsappDevice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsappDevice',
        required: true
    },
    recipients: [{
        phoneNumber: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['queued', 'processing', 'sent', 'delivered', 'read', 'failed'],
            default: 'queued'
        },
        sentAt: {
            type: Date
        },
        deliveredAt: {
            type: Date
        },
        readAt: {
            type: Date
        },
        errorMessage: {
            type: String
        }
    }],
    content: {
        type: String,
        required: true
    },
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MessageTemplate'
    },
    mediaUrls: [{
        type: String
    }],
    scheduledFor: {
        type: Date
    },
    type: {
        type: String,
        enum: ['individual', 'bulk', 'promotional'],
        default: 'individual'
    },
    status: {
        type: String,
        enum: ['scheduled', 'processing', 'completed', 'cancelled', 'failed'],
        default: 'scheduled'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', MessageSchema);

// models/ApiKey.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const ApiKeySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    key: {
        type: String,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date
    }
}, {
    timestamps: true
});

// Generate API Key
ApiKeySchema.pre('save', function(next) {
    if (!this.isModified('key') && this.key) {
        return next();
    }
    
    this.key = crypto.randomBytes(32).toString('hex');
    next();
});

module.exports = mongoose.model('ApiKey', ApiKeySchema);

// models/LoginLog.js
const mongoose = require('mongoose');

const LoginLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ipAddress: {
        type: String
    },
    browser: {
        type: String
    },
    device: {
        type: String
    },
    loginTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success'
    }
});

module.exports = mongoose.model('LoginLog', LoginLogSchema);

// models/Setting.js
const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['delay', 'proxy', 'smtp', 'scanning', 'notification', 'payment']
    },
    key: {
        type: String,
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String
    }
}, {
    timestamps: true
});

// Compound index to make the combination of category and key unique
SettingSchema.index({ category: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Setting', SettingSchema);

// models/index.js
module.exports = {
    User: require('./User'),
    Plan: require('./Plan'),
    UserPlan: require('./UserPlan'),
    WhatsappDevice: require('./WhatsappDevice'),
    MessageTemplate: require('./MessageTemplate'),
    Message: require('./Message'),
    ApiKey: require('./ApiKey'),
    LoginLog: require('./LoginLog'),
    Setting: require('./Setting')
};