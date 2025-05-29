import prisma from '../utils/prismaClient';
import { Contact, LinkPrecedence } from '@prisma/client';

interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

interface IdentifyResponse {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

export class ContactService {
  async identifyContact(data: IdentifyRequest): Promise<IdentifyResponse> {
    const { email, phoneNumber } = data;

    // Find contacts by email or phone number
    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email } : {},
          phoneNumber ? { phoneNumber } : {},
        ],
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (matchingContacts.length === 0) {
      // No existing contact, create a new primary contact
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          linkPrecedence: LinkPrecedence.primary,
        },
      });
      return this.formatResponse(newContact, []);
    }

    // Identify all unique primary contacts from the matching set
    let primaryContacts: Contact[] = [];
    const linkedContactIds = new Set<number>();

    for (const contact of matchingContacts) {
      if (contact.linkPrecedence === LinkPrecedence.primary) {
        primaryContacts.push(contact);
      } else if (contact.linkedId) {
        // If secondary, find its primary
        const primary = await prisma.contact.findUnique({
          where: { id: contact.linkedId, deletedAt: null },
        });
        if (primary && primary.linkPrecedence === LinkPrecedence.primary) { // Ensure it's indeed primary
          primaryContacts.push(primary);
        }
      }
    }
    
    // Deduplicate primary contacts and sort by creation date to find the oldest
    const uniquePrimaryContacts = Array.from(new Map(primaryContacts.map(c => [c.id, c])).values())
                                      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let ultimatePrimaryContact: Contact;
    let contactsToUpdate: Contact[] = [];

    if (uniquePrimaryContacts.length === 0) {
        // This case can happen if all matchingContacts were secondary and their primaries were deleted or also secondary (data inconsistency)
        // Or if matchingContacts only contained secondaries whose primaries were not in matchingContacts.
        // For simplicity, we'll take the oldest of the matching contacts and promote or create a new primary if needed.
        // A more robust solution might involve deeper graph traversal or error handling.
        // Here, we'll take the oldest of the initially matched contacts. If all are secondary, we make the oldest of them a new primary,
        // or create a new one if the request details don't match any existing.
        
        const oldestMatchedContact = matchingContacts[0]; // Already sorted by createdAt

        if (oldestMatchedContact.linkPrecedence === LinkPrecedence.secondary && oldestMatchedContact.linkedId) {
             const foundPrimary = await prisma.contact.findUnique({where: {id: oldestMatchedContact.linkedId, deletedAt: null}});
             if (foundPrimary) {
                ultimatePrimaryContact = foundPrimary;
             } else {
                // Primary not found, promote oldestMatchedContact or create new.
                // For this scenario, let's create a new primary based on request.
                // This part can be complex depending on desired behavior for orphaned secondaries.
                const newContact = await prisma.contact.create({
                    data: {
                      email: email || null,
                      phoneNumber: phoneNumber || null,
                      linkPrecedence: LinkPrecedence.primary,
                    },
                });
                return this.formatResponse(newContact, []);
             }
        } else {
             ultimatePrimaryContact = oldestMatchedContact; // It's a primary or will be treated as one
        }

    } else {
        ultimatePrimaryContact = uniquePrimaryContacts[0]; // The oldest primary

        // If there are multiple primary contacts, link others to the ultimatePrimaryContact
        if (uniquePrimaryContacts.length > 1) {
          for (let i = 1; i < uniquePrimaryContacts.length; i++) {
            const contactToDemote = uniquePrimaryContacts[i];
            contactsToUpdate.push({
              ...contactToDemote,
              linkedId: ultimatePrimaryContact.id,
              linkPrecedence: LinkPrecedence.secondary,
            });
            // Also update all contacts previously linked to this demoted primary
             const secondariesOfDemoted = await prisma.contact.findMany({
                where: { linkedId: contactToDemote.id, deletedAt: null}
             });
             secondariesOfDemoted.forEach(sec => {
                contactsToUpdate.push({
                    ...sec,
                    linkedId: ultimatePrimaryContact.id,
                });
             });
          }
        }
    }


    // Check if the current request introduces new information or a new combination
    // Gather all contacts linked to the ultimatePrimaryContact (including itself)
    let allRelatedContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { id: ultimatePrimaryContact.id },
                { linkedId: ultimatePrimaryContact.id }
            ],
            deletedAt: null
        }
    });
    
    // Include contacts that are about to be updated to link to this ultimatePrimaryContact
    contactsToUpdate.forEach(updatedContact => {
        if (updatedContact.id !== ultimatePrimaryContact.id) { // Avoid duplicating primary
            const existingIndex = allRelatedContacts.findIndex(c => c.id === updatedContact.id);
            if (existingIndex !== -1) {
                allRelatedContacts[existingIndex] = { ...allRelatedContacts[existingIndex], ...updatedContact }; // Reflect changes
            } else {
                // This contact might be newly linked (e.g. a primary being demoted that wasn't directly fetched before)
                // For simplicity, we re-fetch after updates if this becomes too complex.
                // Or ensure allRelatedContacts considers the pre-update state correctly.
            }
        }
    });


    const existingEmails = new Set(allRelatedContacts.map(c => c.email).filter(Boolean) as string[]);
    const existingPhoneNumbers = new Set(allRelatedContacts.map(c => c.phoneNumber).filter(Boolean) as string[]);

    const isNewEmail = email && !existingEmails.has(email);
    const isNewPhoneNumber = phoneNumber && !existingPhoneNumbers.has(phoneNumber);

    let newSecondaryContactCreated = false;
    // Create a new secondary contact if new information is provided AND this exact combination doesn't exist
    if ((email || phoneNumber) && (isNewEmail || isNewPhoneNumber)) {
        // Check if a contact with this exact combination already exists in the group
        const exactMatchExists = allRelatedContacts.some(c => c.email === (email || null) && c.phoneNumber === (phoneNumber || null));

        if (!exactMatchExists) {
            const newSecondaryData: any = {
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkedId: ultimatePrimaryContact.id,
                linkPrecedence: LinkPrecedence.secondary,
            };
             // Only add to contactsToUpdate if it's a new record, not an update of an existing one.
             // The logic above handles updates. This is specifically for creating a new secondary.
            const createdSecondary = await prisma.contact.create({ data: newSecondaryData });
            contactsToUpdate.push(createdSecondary); // This isn't an update, it's a new record.
                                                 // Better to handle its creation separately or add to allRelatedContacts post-creation.
            newSecondaryContactCreated = true;
        }
    }

    // Perform database updates in a transaction
    if (contactsToUpdate.length > 0) {
        await prisma.$transaction(
            contactsToUpdate.map(contact =>
              prisma.contact.update({
                where: { id: contact.id },
                data: {
                  email: contact.email,
                  phoneNumber: contact.phoneNumber,
                  linkedId: contact.linkedId,
                  linkPrecedence: contact.linkPrecedence,
                },
              })
            )
        );
    }

    // Re-fetch all related contacts to ensure we have the latest state for response
    const finalGroupContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: ultimatePrimaryContact.id },
          { linkedId: ultimatePrimaryContact.id },
        ],
        deletedAt: null,
      },
      orderBy: { // Ensure primary contact is first if fetched this way, though we use its direct object
        createdAt: 'asc'
      }
    });
    
    // Find the true ultimate primary from the final group again, in case it was changed
    // This is important if the original ultimatePrimaryContact itself was demoted or modified.
    const primaryInFinalGroup = finalGroupContacts.find(c => c.id === ultimatePrimaryContact.id && c.linkPrecedence === LinkPrecedence.primary) ||
                                finalGroupContacts.find(c => c.linkPrecedence === LinkPrecedence.primary) || // any primary if original was demoted
                                finalGroupContacts[0]; // fallback to the oldest if no clear primary (should not happen with good data)

    return this.formatResponse(primaryInFinalGroup || ultimatePrimaryContact, finalGroupContacts);
  }

  private formatResponse(primaryContact: Contact, allContacts: Contact[]): IdentifyResponse {
    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();
    const secondaryContactIds = new Set<number>();

    if (primaryContact.email) emails.add(primaryContact.email);
    if (primaryContact.phoneNumber) phoneNumbers.add(primaryContact.phoneNumber);

    allContacts.forEach(contact => {
      if (contact.id === primaryContact.id) return; // Already processed primary
      
      // If a contact became secondary to this primaryContact
      if (contact.linkedId === primaryContact.id || allContacts.find(c => c.id === contact.linkedId && c.linkedId === primaryContact.id)) {
        if (contact.email) emails.add(contact.email);
        if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
        secondaryContactIds.add(contact.id);
      } else if (contact.linkPrecedence === LinkPrecedence.primary && contact.id !== primaryContact.id) {
        // This means another primary was found but not (yet) correctly linked in allContacts list.
        // This indicates a potential issue in how allContacts was gathered post-update.
        // For robust formatting, ensure allContacts truly reflects the final state around the primaryContact.
      } else if (contact.linkPrecedence === LinkPrecedence.secondary) { // General secondary contacts
        if (contact.email) emails.add(contact.email);
        if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
        secondaryContactIds.add(contact.id);
      }
    });
    
    // Ensure primary's info is first
    const finalEmails = [
        ...(primaryContact.email ? [primaryContact.email] : []),
        ...Array.from(emails).filter(e => e !== primaryContact.email).sort()
    ];
    const finalPhoneNumbers = [
        ...(primaryContact.phoneNumber ? [primaryContact.phoneNumber] : []),
        ...Array.from(phoneNumbers).filter(p => p !== primaryContact.phoneNumber).sort()
    ];


    return {
      contact: {
        primaryContatctId: primaryContact.id,
        emails: [...new Set(finalEmails)], // Deduplicate again just in case
        phoneNumbers: [...new Set(finalPhoneNumbers)], // Deduplicate
        secondaryContactIds: Array.from(secondaryContactIds).sort((a,b) => a - b),
      },
    };
  }
}