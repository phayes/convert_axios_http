This is a typescript utility package that does the following:

1. Given a raw http request (an array buffer of bytes), convert it to an axios request object
2. Given an axios request object, convert it to a raw http bytes
3. Given a raw http response (as an arraybuffer of bytes), convert it to an axios response object
4. Given a axios response object, convert it to an array of bytes that represents a full http response bytes (as an arraybuffer)


In additional to all the regular stuff, it handles basic multipart forms and files uploads

Here's an example of how you might use this as a part of an axios adapter:

TODO