const tar = require('tar');
const axios = require("axios");
const fs = require('fs');

const versionList = 'http://ddragon.leagueoflegends.com/api/versions.json';
//Location of the versioned tarball
const tarSet = (version) => `https://ddragon.leagueoflegends.com/cdn/dragontail-${version}.tgz`
const baseUri = 'http://localhost:8085';
const fileSystem = 'C:/CDNData';
const championImagePath = `${baseUri}/img/champion`;
module.exports = {
    championImagePath
}
const wsconfig = {
    method: "get",
    responseType: "stream"
  };
let latestFolder;

//Gets the latest tar and stores it to local disk. This is ideal if the CDN is hosted on the same server as this script.
const updateTar = async () => {
    let versions;
    try{
        versions = (await axios.get(versionList)).data;
    }
    catch{
        console.error("Unable to fetch updated version list");
        return;
    }
    versionIndex = 0;
    let tarballResponse, version;
    do{
        version = versions[versionIndex++];
        try{
            await axios.get(`${baseUri}/${version}`);
            return baseUri;
        }
        catch{
            
        }
        try{
            tarballResponse = await axios.get(tarSet(version), wsconfig);
        }
        catch{
            console.error(`Unable to find tarball for version ${version}`);
        }
    } while (tarballResponse.status != 200)
    //If you want to store your files on an S3 bucket or external CDN, then the response should be streamed to that destination and extracted there.
    await tarballResponse.data.pipe(tar.x({C: fileSystem, strip: 1}, [`${version}/img`]));
    fs.writeFileSync(fileSystem + '/' + version);
    return baseUri;
}

updateTar();