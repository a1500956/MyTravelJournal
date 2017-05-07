
package com.traveljournal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.core.annotation.HandleBeforeCreate;
import org.springframework.data.rest.core.annotation.RepositoryEventHandler;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.traveljournal.domain.Entry;
import com.traveljournal.domain.Manager;
import com.traveljournal.domain.ManagerRepository;


@Component
@RepositoryEventHandler(Entry.class)
public class SpringDataRestEventHandler {

	private final ManagerRepository managerRepository;

	@Autowired
	public SpringDataRestEventHandler(ManagerRepository managerRepository) {
		this.managerRepository = managerRepository;
	}

	@HandleBeforeCreate
	public void applyUserInformationUsingSecurityContext(Entry entry) {

		String name = SecurityContextHolder.getContext().getAuthentication().getName();
		Manager manager = this.managerRepository.findByName(name);
		if (manager == null) {
			Manager newManager = new Manager();
			newManager.setName(name);
			newManager.setRoles(new String[]{"ROLE_MANAGER"});
			manager = this.managerRepository.save(newManager);
		}
		entry.setManager(manager);
	}
}

