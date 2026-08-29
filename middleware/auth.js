const User = require("../models/User");

function isLoggedIn(req, res, next) {
    if (!req.session.user) return res.redirect("/customer/login");
    next();
}

function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            if (!req.session.user) return res.redirect("/customer/login");

            const user = await User.findById(req.session.user.id);
            if (!user) {
                req.session.destroy(() => res.redirect("/customer/login"));
                return;
            }

            if (!roles.includes(user.role)) {
                return res.status(403).render("error", {
                    error: "Access denied for your role."
                });
            }

            req.currentUser = user;
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { isLoggedIn, requireRole };
