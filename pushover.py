import requests

class Pushover:
    SEND_MESSAGE_ENDPOINT = "https://api.pushover.net/1/messages.json"

    def __init__(self, api_token, user_key):
        self.api_token = api_token
        self.user_key = user_key

    def send_message(self, message, title):
        data = {
            "token": self.api_token,
            "user": self.user_key,
            "message": message,
            "title": title
        }

        response = requests.post(self.SEND_MESSAGE_ENDPOINT, data=data)
        if response.status_code == 200:
            print("Notification sent successfully!")
        else:
            print(f"Error: {response.status_code}, {response.text}")
