const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const token = 'EAAOAOc52MyQBACltgCIdjPz2gygn2TZA9UXgKo1qx2ucHqmVuIRjZB1l28RCOY9PqTTNmZBfGcwKGZCmbxZAwXhRf63DMt88MidpvUygRNlVbp9nGBv7i4E1N9UGJoB6RBzZCapdEjLx4hvplZBVh7YquNowZBMYQkYtC4X7GwvvYxcC4f7gfpIH7uoRSFNOGZAaZBsCjZAj5hZConlWoIayE6Wn';

const axiosInstance = axios.create({
  baseURL: 'https://graph.facebook.com/v13.0',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})

const app = express();
app.use(bodyParser.json());

app.listen(80, () => {
  console.log('Server is running on port 80');
});

app.get('/', (req, res) => {
  res.send('hola mundo')
})

// validar servidores
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'mitokendeprueba') {
    res.send(req.query['hub.challenge']);
  } else {
    res.status(401).json({ mdg: 'Denied' });
  }
})

// validar eventos
app.post('/webhook', function (req, res) {
  const data = req.body;
  // console.log(data)
  if (data.object === 'whatsapp_business_account') {
    if (data.entry) {
      // console.log('entry', data.entry);
      data.entry.forEach(function (entry) {
        if (entry.changes?.length && entry.changes[0].value?.messages?.length) {
          const phoneId = entry.changes[0].value.metadata.phone_number_id;
          const recipentWaId = entry.changes[0].value?.messages[0].from;
          // const text = entry.changes[0].value?.messages[0].text.body;
          // console.log(entry.changes[0].value?.messages[0].text.body);
          // console.log(entry.changes[0].value);

          // const dataToPost = {
          //   "messaging_product": "whatsapp",
          //   "to": `${recipentWaId}`,
          //   "type": "template",
          //   // "text": { body: '*Hola Mundo* 😄' },
          //   "template": {
          //     "name": "primera_eleccion",
          //     "language": {
          //       "code": "es_MX"
          //     }
          //   }
          // }

          const dataToPost = {
            "messaging_product": "whatsapp",
            "preview_url": false,
            "recipient_type": "individual",
            "to": `${recipentWaId}`,
            "type": "text",
            "text": { body: 'Hola Mundo' },
          }

          // const dataToPost = {
          //   "messaging_product": "whatsapp",
          //   "to": `${recipentWaId}`,
          //   "type": "template",
          //   "template": {
          //     "name": "hello_world",
          //     "language": {
          //       "code": "en_US"
          //     }
          //   }
          // }

          callSendAPI(dataToPost, phoneId);
        }
      });
    }
    res.sendStatus(200);
  }
})

async function callSendAPI(messageData, phoneNumber) {
  try {
    const { data } = await axiosInstance.post(`/${phoneNumber}/messages`, messageData);
    console.log('success', data);
  } catch (error) {
    console.log(error);
  }
}
