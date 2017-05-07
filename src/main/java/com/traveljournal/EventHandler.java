
package com.traveljournal;

import static com.traveljournal.WebSocketConfiguration.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.core.annotation.HandleAfterCreate;
import org.springframework.data.rest.core.annotation.HandleAfterDelete;
import org.springframework.data.rest.core.annotation.HandleAfterSave;
import org.springframework.data.rest.core.annotation.RepositoryEventHandler;
import org.springframework.hateoas.EntityLinks;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.traveljournal.domain.Entry;


@Component
@RepositoryEventHandler(Entry.class)
public class EventHandler {

	private final SimpMessagingTemplate websocket;

	private final EntityLinks entityLinks;

	@Autowired
	public EventHandler(SimpMessagingTemplate websocket, EntityLinks entityLinks) {
		this.websocket = websocket;
		this.entityLinks = entityLinks;
	}

	@HandleAfterCreate
	public void newEntry(Entry entry) {
		this.websocket.convertAndSend(
				MESSAGE_PREFIX + "/newEntry", getPath(entry));
	}

	@HandleAfterDelete
	public void deleteEntry(Entry entry) {
		this.websocket.convertAndSend(
				MESSAGE_PREFIX + "/deleteEntry", getPath(entry));
	}

	@HandleAfterSave
	public void updateEntry(Entry entry) {
		this.websocket.convertAndSend(
				MESSAGE_PREFIX + "/updateEntry", getPath(entry));
	}

	
	private String getPath(Entry entry) {
		return this.entityLinks.linkForSingleResource(entry.getClass(),
				entry.getId()).toUri().getPath();
	}

}

