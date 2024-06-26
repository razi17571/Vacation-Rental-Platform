const Listing = require('../models/Listing');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports = {
    searchListings: async (req, res) => {
        const { query } = req.query;
        try {
            const searchResults = await Listing.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } }, 
                    { description: { $regex: query, $options: 'i' } }, 
                    { location: { $regex: query, $options: 'i' } },
                    { country: { $regex: query, $options: 'i' } }, 
                    { category: { $regex: query, $options: 'i' } } 
                ]
            });
            res.render("listings/searchResults", { searchResults });
        } catch (err) {
            console.error("Error searching listings:", err);
            req.flash("error", "An error occurred while searching listings.");
            res.redirect("/listings");
        }
    },

    index: async (req, res) => {
        try {
            let filter = req.query.category ? { category: req.query.category } : {};
            let sortOption = {};
    
            switch (req.query.sort) {
                case 'az':
                    sortOption = { title: 1 }; // Sort A-Z by listing title
                    break;
                case 'za':
                    sortOption = { title: -1 }; // Sort Z-A by listing title
                    break;
                case 'lowHigh':
                    sortOption = { price: 1 }; // Sort by price low to high
                    break;
                case 'highLow':
                    sortOption = { price: -1 }; // Sort by price high to low
                    break;
                case 'rating':
                    sortOption = { rating: -1 }; // Sort by rating descending
                    break;
                default:
                    // No sort or unrecognized value, default behavior (optional)
                    break;
            }
    
            const allListings = await Listing.find(filter).sort(sortOption);
            res.render("listings/index.ejs", { allListings });
        } catch (err) {
            console.error("Error fetching all listings:", err);
            req.flash("error", "An error occurred while fetching listings.");
            res.redirect("/listings");
        }
    },    

    renderNewForm: (req, res) => {
        res.render("listings/addListing.ejs");
    },

    showListing: async (req, res) => {
        try {
            const { id } = req.params;
            const listing = await Listing.findById(id)
                .populate({ path: "reviews", populate: { path: "author" } })
                .populate("owner");
            if (!listing) {
                req.flash("error", "Listing not found!");
                return res.redirect("/listings");
            }
            res.render("listings/showListing.ejs", { listing });
        } catch (err) {
            console.error("Error fetching listing:", err);
            req.flash("error", "An error occurred while fetching the listing.");
            res.redirect("/listings");
        }
    },

    createListing: async (req, res) => {
        try {
            const response = await geocodingClient.forwardGeocode({
                query: req.body.listing.location,
                limit: 1,
            }).send();

            const url = req.file.path;
            const filename = req.file.filename;
            const newListing = new Listing(req.body.listing);
            newListing.owner = req.user._id;
            newListing.image = { url, filename };
            newListing.geometry = response.body.features[0].geometry;
            await newListing.save();
            req.flash("success", "New listing created!");
            res.redirect("/listings");
        } catch (err) {
            console.error("Error creating listing:", err);
            req.flash("error", "Failed to create new listing.");
            res.redirect("/listings/new");
        }
    },

    renderEditForm: async (req, res) => {
        try {
            const { id } = req.params;
            const listing = await Listing.findById(id);
            if (!listing) {
                req.flash("error", "Listing not found!");
                return res.redirect("/listings");
            }
            let originalImageUrl = listing.images.url;
            originalImageUrl = originalImageUrl.replace("/upload", "/upload/c_scale,h_250,w_370/");
            res.render("listings/editListing.ejs", { listing, originalImageUrl });
        } catch (err) {
            console.error("Error rendering edit form:", err);
            req.flash("error", "An error occurred while rendering the edit form.");
            res.redirect("/listings");
        }
    },

    updateListing: async (req, res) => {
        try {
            const { id } = req.params;
            const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
            if (req.file) {
                const url = req.file.path;
                const filename = req.file.filename;
                listing.image = { url, filename };
                await listing.save();
            }
            req.flash("success", "Updated listing!");
            res.redirect(`/listings/${id}`);
        } catch (err) {
            console.error("Error updating listing:", err);
            req.flash("error", "Failed to update listing.");
            res.redirect(`/listings/${id}/edit`);
        }
    },

    destroyListing: async (req, res) => {
        try {
            const { id } = req.params;
            await Listing.findByIdAndDelete(id);
            req.flash("success", "Deleted listing!");
            res.redirect("/listings");
        } catch (err) {
            console.error("Error deleting listing:", err);
            req.flash("error", "Failed to delete listing.");
            res.redirect("/listings");
        }
    }
};
