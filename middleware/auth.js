require("dotenv").config(); // allows us to access env variables

module.exports = async(req, res, next) => {
  try {
		// have to have a token
		if(false) {
			return res.status(403).json("Not authorised");
		}

		req.user = "issuer";

		// continue the route
		next();
  } catch (err) {
    console.error(err.message);
		return res.status(403).json("Not authorised");
  }
};