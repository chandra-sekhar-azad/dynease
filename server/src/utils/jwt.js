const jwt = require('jsonwebtoken');

const signToken = (id, sessionVersion = 0) => {
  return jwt.sign({ id, sessionVersion }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const createSendToken = (user, statusCode, res) => {
  const userId = user.id || user._id;
  const token = signToken(userId, user.sessionVersion || 0);

  // Remove passwords and methods from output
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.password_hash;
  delete safeUser.comparePassword;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user: safeUser
    }
  });
};

module.exports = { signToken, createSendToken };

