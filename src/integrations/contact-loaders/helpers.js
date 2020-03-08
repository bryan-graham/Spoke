import { completeContactLoad, getTimezoneByZip } from "../../workers/jobs";
import { r, CampaignContact } from "../../server/models";

export const finalizeContactLoad = async (job, inputContacts, maxContacts) => {
  const campaignId = job.campaign_id;

  let contacts = inputContacts;

  await r
    .knex("campaign_contact")
    .where("campaign_id", campaignId)
    .delete();

  if (maxContacts) {
    // note: maxContacts == 0 means no maximum
    contacts = contacts.slice(0, maxContacts);
  }
  const chunkSize = 1000;

  const numChunks = Math.ceil(contacts.length / chunkSize);

  for (let index = 0; index < contacts.length; index++) {
    const datum = contacts[index];
    if (datum.zip) {
      // using memoization and large ranges of homogenous zips
      datum.timezone_offset = await getTimezoneByZip(datum.zip);
    }
    datum.campaign_id = campaignId;
  }
  for (let index = 0; index < numChunks; index++) {
    const savePortion = contacts.slice(
      index * chunkSize,
      (index + 1) * chunkSize
    );
    await CampaignContact.save(savePortion).catch(err => {
      // eslint-disable-next-line no-console
      console.error("Error saving campaign contacts:", campaignId, err);
    });
  }

  await completeContactLoad(job, []);
};
