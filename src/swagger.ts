import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DealGe VIN Extractor API",
      version: "1.0.0",
      description: "Extract VIN from car listing images",
    },
    servers: [
      {
        url: "http://localhost:3002",
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // 👈 important
};

export const swaggerSpec = swaggerJsdoc(options);