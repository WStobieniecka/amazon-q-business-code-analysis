#!/usr/bin/env bash
############################################################
# Help                                                     #
############################################################
Help()
{
   # Display Help
   echo "Add webhook to repo."
   echo
   echo "Syntax: create-webhook.sh [-h|-o org -r repo -u url -t token]"
   echo "options:"
   echo "-o     Enter the org name."
   echo "-h     Print this Help."
   echo "-r     Enter the repo name"
   echo "-t     Enter the repo auth token e.g. \$(gh auth token)"
   echo "-u     Enter the webhook url"
   echo
}

Webhook()
{
  curl "https://api.github.com/repos/$org/$repo/hooks" \
       -H "Authorization: Token $token" \
       -d @- << EOF
  {
    "name": "web",
    "active": true,
    "events": [
      "push"
    ],
    "config": {
      "url": "$url",
      "content_type": "json"
    }
  }
EOF
}

############################################################
############################################################
# Main program                                             #
############################################################
############################################################

# Set variables
org=""
repo=""
token=""
url=""

############################################################
# Process the input options. Add options as needed.        #
############################################################
# Get the options
while getopts ":h:o:r:t:u:" option; do
   case $option in
      h) # display Help
         Help
         exit;;
      o) # Enter a name
         org=$OPTARG;;
      r) # Enter a name
         repo=$OPTARG;;
      t) # Enter a name
         token=$OPTARG;;
      u) # Enter a name
         url=$OPTARG;;
     \?) # Invalid option
         echo "Error: Invalid option"
         exit;;
   esac
done

echo "Org: $org, Repo: $repo, Token: $token, Url: $url"
if [ -z $org ] || [ -z $repo ] || [ -z $token ] || [ -z $url ]; then
  Help
else
  Webhook
fi