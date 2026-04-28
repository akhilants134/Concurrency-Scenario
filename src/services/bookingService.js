const prisma = require("../prismaClient");

const createBooking = async ({ userId, seatId, showId }) => {
  try {
    const booking = await prisma.booking.create({
      data: {
        userId,
        seatId,
        showId,
      },
    });

    return {
      success: true,
      booking,
    };
  } catch (err) {
    if (err.code === "P2002") {
      return {
        success: false,
        status: 409,
        message: "Seat already taken for this show",
      };
    }

    throw err;
  }
};

module.exports = {
  createBooking,
};
