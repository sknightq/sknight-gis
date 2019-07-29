FROM ubuntu:18.04

FROM nginx

WORKDIR /var/www/sknight-gis

COPY . /var/www/sknight-gis

COPY ./sknight-gis.conf /etc/nginx/conf.d/

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]