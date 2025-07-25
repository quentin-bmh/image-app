FROM node:18

WORKDIR /app

COPY package*.json ./

# Installe nodemon globalement pour   viter les erreurs de permissions
RUN npm install -g nodemon && npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]