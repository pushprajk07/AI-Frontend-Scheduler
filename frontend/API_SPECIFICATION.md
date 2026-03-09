# API Specification

## AI Endpoints

### Generate AI Content
- **URL:** `/ai/generate-content`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "name": "string",
    "meetingType": "Demo | Interview | Consultation",
    "date": "string",
    "time": "string",
    "tone": "Persuasive | Formal | Friendly Professional"
  }
  ```
- **Response:**
  ```json
  {
    "confirmationEmail": "string",
    "rescheduleMessage": "string",
    "cancellationMessage": "string",
    "reminderMessage": "string",
    "meetingAgenda": "string"
  }
  ```

### Suggest Alternative Slots
- **URL:** `/ai/suggest-slots`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "currentDate": "string",
    "currentTime": "string",
    "meetingType": "Demo | Interview | Consultation"
  }
  ```
- **Response:**
  ```json
  {
    "slots": [
      {
        "date": "string",
        "time": "string"
      }
    ]
  }
  ```

## Appointment Endpoints

### List Appointments
- **URL:** `/appointments`
- **Method:** `GET`
- **Response:** `Appointment[]`

### Create Appointment
- **URL:** `/appointments`
- **Method:** `POST`
- **Request Body:** `Partial<Appointment>`
- **Response:** `Appointment`

### Update Appointment
- **URL:** `/appointments/:id`
- **Method:** `PATCH`
- **Request Body:** `Partial<Appointment>`
- **Response:** `Appointment`

### Delete Appointment
- **URL:** `/appointments/:id`
- **Method:** `DELETE`
- **Response:** `{ success: boolean }`
